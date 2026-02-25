import { useCallback, useEffect, useState } from "react";
import { ensureUserProfile, supabase, toUserErrorMessage } from "../config/supabase";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AppContext } from "./AppContextObject";

const isDev = import.meta.env.DEV;
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

const AppContextProvider = (props) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState([]);
  const [messagesId, setMessagesId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);

  const clearAppState = useCallback(() => {
    setUserData(null);
    setChatData([]);
    setMessagesId(null);
    setMessages([]);
    setChatUser(null);
    setChatVisible(false);
  }, []);

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

  const loadUserData = useCallback(async (uid, authUser = null) => {
    try {
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
        };
      }

      if (error) {
        logWarn("Profile read error after bootstrap:", error.message);
      }

      setUserData(data);

      if (data.avatar && data.name) {
        navigate("/chat");
      } else {
        navigate("/profile-update");
      }

      // Update lastSeen in background
      supabase.from("users").update({ last_seen: Date.now() }).eq("id", uid);
    } catch (error) {
      logError("loadUserData error:", error);
      toast.error(toUserErrorMessage(error));
    }
  }, [navigate]);

  useEffect(() => {
    if (!userData?.id) return;

    let pollingId;
    let isActive = true;

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
          userData: usersById.get(item.rId) || fallbackChatUser(item.rId),
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
    pollingId = setInterval(fetchChats, 5000);

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
      .subscribe();

    return () => {
      isActive = false;
      clearInterval(pollingId);
      supabase.removeChannel(channel);
    };
  }, [userData]);

  const value = {
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
    clearAppState,
  };

  return (
    <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
  );
};

export default AppContextProvider;
