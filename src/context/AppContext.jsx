import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureUserProfile,
  isDesignPreviewMode,
  supabase,
  toUserErrorMessage,
} from "../config/supabase";
import { setKnownUser } from "../lib/knownUser";
import { startVideoSession } from "../lib/zegoCall";
import {
  getUserPreferencesFromStorage,
  normalizeUserPreferences,
  saveUserPreferencesToStorage,
} from "../lib/userPreferences";
import { useNavigate } from "react-router-dom";
import { notificationHelper } from "../lib/notificationManager";
import { AppContext } from "./AppContextObject";

const PREVIEW_ME = {
  id: "preview-me",
  email: "preview@chatapp.local",
  username: "alok_preview",
  name: "Alok Preview",
  avatar: "",
  bio: "Preview mode: local UI without backend",
  last_seen: Date.now(),
  profile_visibility: "public",
  typing_indicators: "on",
  allow_audio_calls: true,
  allow_video_calls: true,
};

const PREVIEW_FRIEND = {
  id: "preview-friend",
  email: "friend@chatapp.local",
  username: "design_friend",
  name: "Design Friend",
  avatar: "",
  bio: "Let’s verify this layout!",
  last_seen: Date.now(),
  profile_visibility: "public",
  typing_indicators: "on",
  allow_audio_calls: true,
  allow_video_calls: true,
};

const PREVIEW_MESSAGES = [
  {
    sId: "preview-friend",
    text: "Hey! This is local preview mode.",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    sId: "preview-me",
    text: "Perfect, I just need to check the UI.",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    sId: "preview-friend",
    text: "Open profile page and responsive layout too.",
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
];

const PREVIEW_CHAT = {
  rId: PREVIEW_FRIEND.id,
  messageId: "preview-thread-1",
  lastMessage: PREVIEW_MESSAGES[PREVIEW_MESSAGES.length - 1].text,
  updatedAt: Date.now(),
  messageSeen: true,
  userData: PREVIEW_FRIEND,
  previewMessages: PREVIEW_MESSAGES,
};

const isDev = import.meta.env.DEV;
const ONLINE_WINDOW_MS = 70000;
const logWarn = (...args) => {
  if (isDev) console.warn(...args);
};
const logError = (...args) => {
  if (isDev) console.error(...args);
};

const pickFirstDefined = (item, keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const parseTimestamp = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const fallbackChatUser = (id) => ({
  id,
  email: "",
  username: "",
  name: "Unknown user",
  avatar: "",
  bio: "",
  last_seen: 0,
  allow_audio_calls: true,
  allow_video_calls: true,
});

const isAuthOrRlsError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const code = String(error?.code || "");
  const status = Number(error?.status || 0);

  return (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    message.includes("unauthorized") ||
    message.includes("jwt") ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    details.includes("row-level security")
  );
};

const isMissingPreferenceColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const code = String(error?.code || "");
  const status = Number(error?.status || 0);

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("column") ||
    message.includes("could not find") ||
    message.includes("allow_audio_calls") ||
    message.includes("allow_video_calls") ||
    details.includes("column") ||
    details.includes("allow_audio_calls") ||
    details.includes("allow_video_calls") ||
    (status === 400 && (message.includes("bad request") || details.includes("bad request")))
  );
};

const AppContextProvider = (props) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState([]);
  const [messagesId, setMessagesId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInfoPanelOpen, setChatInfoPanelOpen] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState({});
  const callChannelRef = useRef(null);
  const callChannelReadyRef = useRef(false);
  const presenceChannelRef = useRef(null);
  const preferenceColumnsUnsupportedRef = useRef(false);

  const clearAppState = useCallback(() => {
    setUserData(null);
    setChatData([]);
    setMessagesId(null);
    setMessages([]);
    setChatUser(null);
    setChatVisible(false);
    setChatInfoPanelOpen(false);
    setPresenceUsers({});
  }, []);

  const updateCurrentUserPreferences = useCallback(async (preferences = {}) => {
    const currentUserId = String(userData?.id || "").trim();
    if (!currentUserId) return { ok: false };

    const normalizedPreferences = normalizeUserPreferences(preferences, userData || {});
    const nextUserData = {
      ...(userData || {}),
      profile_visibility: normalizedPreferences.profile_visibility,
      typing_indicators: normalizedPreferences.typing_indicators,
      allow_audio_calls: normalizedPreferences.allow_audio_calls,
      allow_video_calls: normalizedPreferences.allow_video_calls,
    };

    setUserData(nextUserData);
    setKnownUser(nextUserData);
    saveUserPreferencesToStorage(currentUserId, nextUserData);

    if (isDesignPreviewMode) {
      return { ok: true };
    }

    let updateError = null;
    const now = Date.now();
    const basePayload = {
      last_seen: nextUserData.profile_visibility === "public" ? now : 0,
    };
    const extendedPayload = {
      profile_visibility: nextUserData.profile_visibility,
      typing_indicators: nextUserData.typing_indicators,
      allow_audio_calls: nextUserData.allow_audio_calls,
      allow_video_calls: nextUserData.allow_video_calls,
      ...basePayload,
    };
    const updatePayload = preferenceColumnsUnsupportedRef.current
      ? basePayload
      : extendedPayload;

    const result = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", currentUserId);
    updateError = result.error;

    if (updateError) {
      if (isMissingPreferenceColumnError(updateError)) {
        preferenceColumnsUnsupportedRef.current = true;
        const fallbackResult = await supabase
          .from("users")
          .update(basePayload)
          .eq("id", currentUserId);
        updateError = fallbackResult.error;
      }
    }

    if (updateError) {
      logWarn("updateCurrentUserPreferences error:", updateError.message || updateError);
      return { ok: false, error: updateError };
    }

    return { ok: true };
  }, [userData]);

  const normalizeChatItem = (item = {}) => ({
    ...item,
    rId: String(
      pickFirstDefined(item, ["rId", "rid", "rID", "receiverId", "receiver_id"]),
    ).trim(),
    messageId: String(
      pickFirstDefined(item, [
        "messageId",
        "messagesId",
        "messageid",
        "messagesid",
        "message_id",
        "messages_id",
      ]),
    ).trim(),
    lastMessage: String(item?.lastMessage ?? item?.last_message ?? ""),
    updatedAt: parseTimestamp(item?.updatedAt ?? item?.updated_at),
    messageSeen: Boolean(item?.messageSeen ?? item?.message_seen ?? true),
  });

  const isUserOnline = useCallback((targetUser) => {
    const targetId = String(targetUser?.id || "").trim();
    if (targetId && presenceUsers[targetId]) {
      return true;
    }
    if (String(targetUser?.profile_visibility || "public") === "private") {
      return false;
    }
    const lastSeen = Number(targetUser?.last_seen || 0);
    if (!lastSeen) return false;
    return Date.now() - lastSeen <= ONLINE_WINDOW_MS;
  }, [presenceUsers]);

  const loadUserData = useCallback(async (uid, authUser = null, options = {}) => {
    try {
      const preserveCurrentRoute = Boolean(options?.preserveCurrentRoute);
      if (isDesignPreviewMode) {
        setUserData(PREVIEW_ME);
        setChatData([PREVIEW_CHAT]);
        setMessagesId(PREVIEW_CHAT.messageId);
        setChatUser(PREVIEW_CHAT);
        setMessages([...(PREVIEW_CHAT.previewMessages || [])].reverse());
        setChatVisible(true);
        if (!preserveCurrentRoute) {
          navigate("/chat");
        }
        return;
      }

      let user = authUser;
      if (!user) {
        const {
          data: { user: fetchedUser },
        } = await supabase.auth.getUser();
        user = fetchedUser;
      }
      if (!user) throw new Error("Auth session missing");

      let { data: userRows, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .limit(1);
      let data = userRows?.[0];

      if (error) {
        logWarn("Initial profile read failed:", error.message);
      }

      if (!data) {
        try {
          await ensureUserProfile(user);
          const refetch = await supabase
            .from("users")
            .select("*")
            .eq("id", uid)
            .limit(1);
          data = refetch.data?.[0];
          error = refetch.error;
        } catch (bootstrapError) {
          logWarn("Profile bootstrap failed:", bootstrapError.message);
        }
      }

      if (!data) {
        // Keep the user moving forward even when profile bootstrap is blocked by RLS/policies.
        data = {
          id: uid,
          email: user.email || "",
          username: user.user_metadata?.username || "",
          name: "",
          avatar: "",
          bio: "",
          last_seen: Date.now(),
          allow_audio_calls: true,
          allow_video_calls: true,
        };
      }

      if (error) {
        logWarn("Profile read error after bootstrap:", error.message);
      }

      const mergedPreferences = normalizeUserPreferences(
        data,
        getUserPreferencesFromStorage(uid),
      );
      setUserData(mergedPreferences);
      setKnownUser(mergedPreferences);
      saveUserPreferencesToStorage(uid, mergedPreferences);

      if (!preserveCurrentRoute) {
        if (data.avatar && data.name) {
          navigate("/chat");
        } else {
          navigate("/profile-update");
        }
      }

    } catch (error) {
      logError("loadUserData error:", error);
      notificationHelper.error(toUserErrorMessage(error));
    }
  }, [navigate]);

  useEffect(() => {
    if (isDesignPreviewMode) return;

    const currentUserId = String(userData?.id || "").trim();
    if (!currentUserId) return;

    const channel = supabase.channel("online-users", {
      config: {
        presence: { key: currentUserId },
      },
    });

    const syncPresenceState = () => {
      const nextPresence = channel.presenceState();
      console.log("presence state", nextPresence);

      const nextUsers = {};
      Object.entries(nextPresence).forEach(([key, entries]) => {
        if (Array.isArray(entries) && entries.length > 0) {
          nextUsers[key] = true;
        }
      });
      setPresenceUsers(nextUsers);
    };

    channel
      .on("presence", { event: "sync" }, syncPresenceState)
      .on("presence", { event: "join" }, syncPresenceState)
      .on("presence", { event: "leave" }, syncPresenceState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      presenceChannelRef.current = null;
      setPresenceUsers({});
      supabase.removeChannel(channel);
    };
  }, [userData?.id]);

  useEffect(() => {
    if (isDesignPreviewMode) return;
    if (!userData?.id) return;

    let pollingId;
    let isActive = true;
    let isRealtimeSubscribed = false;

    const buildChatData = async (rawChatsData) => {
      const chatsData = Array.isArray(rawChatsData) ? rawChatsData : [];
      const normalizedChats = chatsData
        .map(normalizeChatItem)
        .filter((item) => item.rId && item.messageId);

      if (!normalizedChats.length) {
        setChatData([]);
        return;
      }

      const peerIds = [...new Set(normalizedChats.map((item) => item.rId))];
      const usersById = new Map();

      if (peerIds.length) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("*")
          .in("id", peerIds);

        if (usersError) {
          logWarn("buildChatData users fetch error:", usersError.message);
        } else {
          for (const user of users || []) {
            usersById.set(user.id, user);
          }
        }
      }

      if (!isActive) return;

      const hydratedChats = normalizedChats
        .map((item) => ({
          ...item,
          userData: normalizeUserPreferences(
            usersById.get(item.rId) || fallbackChatUser(item.rId),
            getUserPreferencesFromStorage(item.rId),
          ),
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      setChatData(hydratedChats);
    };

    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from("chats")
          .select("chats_data")
          .eq("id", userData.id)
          .limit(1);

        if (error) {
          if (isAuthOrRlsError(error)) {
            if (isActive) setChatData([]);
            return;
          }
          logWarn("fetchChats error:", error.message);
          return;
        }

        const chatRow = data?.[0];

        // No auto-upsert here: with RLS, hidden rows can look like "not found".
        if (!chatRow) {
          if (isActive) setChatData([]);
          return;
        }

        await buildChatData(chatRow.chats_data);
      } catch (error) {
        logWarn("fetchChats unexpected error:", error?.message || error);
      }
    };

    void fetchChats();
    pollingId = setInterval(() => {
      if (!isRealtimeSubscribed) {
        void fetchChats();
      }
    }, 8000);

    const channel = supabase
      .channel(`chats_${userData.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `id=eq.${userData.id}`,
        },
        async (payload) => {
          await buildChatData(payload?.new?.chats_data);
        },
      )
      .subscribe((status) => {
        isRealtimeSubscribed = status === "SUBSCRIBED";
      });

    return () => {
      isActive = false;
      clearInterval(pollingId);
      supabase.removeChannel(channel);
    };
  }, [userData]);

  const initiateCall = useCallback(async (targetId, isGroup = false, callType = "video") => {
    try {
      const callerId = String(userData?.id || "").trim();
      const normalizedTargetId = String(targetId || "").trim();
      if (!callerId || !normalizedTargetId) {
        throw new Error("Invalid caller or target ID.");
      }

      if (callerId === normalizedTargetId) {
        throw new Error("You cannot start a call with yourself.");
      }

      const baseSelect = "id,name,username,last_seen";
      const extendedSelect = `${baseSelect},allow_audio_calls,allow_video_calls`;

      let targetQuery = await supabase
        .from("users")
        .select(preferenceColumnsUnsupportedRef.current ? baseSelect : extendedSelect)
        .eq("id", normalizedTargetId)
        .maybeSingle();

      if (targetQuery.error && isMissingPreferenceColumnError(targetQuery.error)) {
        preferenceColumnsUnsupportedRef.current = true;
        targetQuery = await supabase
          .from("users")
          .select(baseSelect)
          .eq("id", normalizedTargetId)
          .maybeSingle();
      }

      const { data: targetUser, error: targetReadError } = targetQuery;

      if (targetReadError) {
        throw targetReadError;
      }

      if (!targetUser) {
        throw new Error("Target user not found.");
      }

      const normalizedTargetUser = normalizeUserPreferences(
        targetUser,
        getUserPreferencesFromStorage(normalizedTargetId),
      );

      if (callType === "audio" && !normalizedTargetUser.allow_audio_calls) {
        const targetName = String(
          normalizedTargetUser.name || normalizedTargetUser.username || "This user",
        );
        throw new Error(`${targetName} has disabled audio calls.`);
      }

      if (callType !== "audio" && !normalizedTargetUser.allow_video_calls) {
        const targetName = String(
          normalizedTargetUser.name || normalizedTargetUser.username || "This user",
        );
        throw new Error(`${targetName} has disabled video calls.`);
      }

      if (!isUserOnline(normalizedTargetUser)) {
        const targetName = String(
          normalizedTargetUser.name || normalizedTargetUser.username || "This user",
        );
        throw new Error(`${targetName} is offline. Calls are available only when the user is online.`);
      }

      const roomID = isGroup
        ? normalizedTargetId
        : [callerId, normalizedTargetId].sort((a, b) => a.localeCompare(b)).join("_");

      const callerName = String(
        userData?.name || userData?.username || userData?.email || "Unknown Caller",
      );
      const username = String(userData?.username || callerName);
      const normalizedCallType = callType === "audio" ? "audio" : "video";

      const waitUntil = Date.now() + 5000;
      while (!callChannelReadyRef.current && Date.now() < waitUntil) {
        await new Promise((resolve) => {
          setTimeout(resolve, 120);
        });
      }

      const callChannel = callChannelRef.current;
      if (!callChannel || !callChannelReadyRef.current) {
        throw new Error("Failed to subscribe to calls channel.");
      }

      const sendResult = await callChannel.send({
        type: "broadcast",
        event: "VIDEO_CALL_INVITE",
        payload: {
          roomID,
          username,
          callerName,
          callerId,
          targetId: normalizedTargetId,
          type: normalizedCallType,
          isGroup: Boolean(isGroup),
        },
      });

      if (sendResult?.error) {
        throw sendResult.error;
      }

      await startVideoSession(roomID, { id: callerId, name: callerName }, {
        callType: normalizedCallType,
      });
      return { ok: true, roomID };
    } catch (error) {
      logError("initiateCall error:", error);
      notificationHelper.error(toUserErrorMessage(error));
      return { ok: false, error };
    }
  }, [isUserOnline, userData]);

  useEffect(() => {
    if (!userData?.id) return;

    const notifyRoot =
      document.getElementById("call-invite-modal") ||
      document.getElementById("incoming-call-notify");
    const callerInfo = document.getElementById("caller-info");
    const acceptBtn = document.getElementById("accept-btn");
    const declineBtn = document.getElementById("decline-btn");

    let latestPayload = null;

    const hideNotification = () => {
      if (!notifyRoot) return;
      notifyRoot.style.display = "none";
      latestPayload = null;
    };

    const onAccept = async () => {
      const roomID = latestPayload?.roomID;
      if (!roomID) return;

      const currentName = String(
        userData?.name || userData?.username || userData?.email || "Chat User",
      );
      const callType = latestPayload?.type === "audio" ? "audio" : "video";

      hideNotification();
      await startVideoSession(roomID, { id: userData.id, name: currentName }, { callType });
    };

    const onDecline = () => {
      hideNotification();
    };

    if (acceptBtn) acceptBtn.onclick = onAccept;
    if (declineBtn) declineBtn.onclick = onDecline;

    const callChannel = supabase
      .channel("call_channel", {
        config: {
          broadcast: { self: true },
        },
      })
      .on("broadcast", { event: "VIDEO_CALL_INVITE" }, ({ payload }) => {
        if (!payload) return;
        if (payload.callerId === userData.id) return;
        if (String(payload.targetId || "").trim() !== String(userData.id)) return;

        latestPayload = payload;
        const callerName = payload.callerName || payload.username || "Someone";
        if (callerInfo) {
          callerInfo.textContent = `${callerName} is calling`;
        }
        if (notifyRoot) {
          notifyRoot.style.display = "block";
        }
      })
      .subscribe((status) => {
        callChannelReadyRef.current = status === "SUBSCRIBED";
      });

    callChannelRef.current = callChannel;

    return () => {
      if (acceptBtn) acceptBtn.onclick = null;
      if (declineBtn) declineBtn.onclick = null;
      if (notifyRoot) notifyRoot.style.display = "none";
      callChannelReadyRef.current = false;
      callChannelRef.current = null;
      supabase.removeChannel(callChannel);
    };
  }, [userData]);

  const value = useMemo(() => ({
    userData,
    setUserData,
    chatData,
    setChatData,
    loadUserData,
    messages,
    setMessages,
    messagesId,
    setMessagesId,
    chatUser,
    setChatUser,
    chatVisible,
    setChatVisible,
    chatInfoPanelOpen,
    setChatInfoPanelOpen,
    initiateCall,
    isUserOnline,
    updateCurrentUserPreferences,
    clearAppState,
  }), [
    userData,
    chatData,
    loadUserData,
    messages,
    messagesId,
    chatUser,
    chatVisible,
    chatInfoPanelOpen,
    initiateCall,
    isUserOnline,
    updateCurrentUserPreferences,
    clearAppState,
  ]);

  return (
    <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
  );
};

export default AppContextProvider;
