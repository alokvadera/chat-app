import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./ChatBox.css";
import assets from "../../assets/assets";
import { AppContext } from "../../context/AppContextObject";
import {
  isDesignPreviewMode,
  supabase,
  toUserErrorMessage,
} from "../../config/supabase";
import upload from "../../lib/upload";
import { notificationHelper } from "../../lib/notificationManager";

const EMOJI_OPTIONS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "😎",
  "🤝",
  "👍",
  "👏",
  "🎉",
  "🔥",
  "💙",
  "✅",
  "🙌",
  "🤔",
  "😅",
  "😴",
];

const ChatBox = () => {
  const {
    userData,
    messagesId,
    chatUser,
    messages,
    setMessages,
    chatVisible,
    setChatVisible,
    setChatInfoPanelOpen,
    initiateCall,
    isUserOnline,
    updateCurrentUserPreferences,
  } = useContext(AppContext);

  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const prevActiveMessageIdRef = useRef("");
  const prevMessageCountRef = useRef(0);
  const scrollToBottom = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, []);
  const currentUserAvatar = userData?.avatar || assets.avatar_icon;
  const chatUserAvatar = chatUser?.userData?.avatar || assets.avatar_icon;
  const getMessageId = (item) =>
    String(
      item?.messageId ??
        item?.messagesId ??
        item?.messageid ??
        item?.messagesid ??
        item?.message_id ??
        item?.messages_id ??
        "",
    ).trim();
  const toMessagesArray = (value) => (Array.isArray(value) ? value : []);
  const isNearBottom = useCallback((threshold = 120) => {
    const container = chatMessagesRef.current;
    if (!container) return true;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    return remaining <= threshold;
  }, []);

  const areMessagesEqual = useCallback((left = [], right = []) => {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      const prevItem = left[index] || {};
      const nextItem = right[index] || {};
      if (
        String(prevItem.sId || "") !== String(nextItem.sId || "") ||
        String(prevItem.text || "") !== String(nextItem.text || "") ||
        String(prevItem.image || "") !== String(nextItem.image || "") ||
        String(prevItem.createdAt || "") !== String(nextItem.createdAt || "")
      ) {
        return false;
      }
    }
    return true;
  }, []);

  const updateMessagesIfChanged = useCallback((nextMessages) => {
    const normalizedNext = [...toMessagesArray(nextMessages)];
    setMessages((prev) => {
      const prevNormalized = toMessagesArray(prev);
      return areMessagesEqual(prevNormalized, normalizedNext)
        ? prev
        : normalizedNext;
    });
  }, [areMessagesEqual, setMessages]);

  const chatMessagesId = getMessageId(chatUser);
  const activeMessageId = String(messagesId || chatMessagesId || "").trim();
  const currentUserTypingEnabled =
    String(userData?.typing_indicators || "on") === "on";
  const currentUserVisibility = String(userData?.profile_visibility || "public");
  const shouldBroadcastTyping = currentUserTypingEnabled && currentUserVisibility !== "private";
  const peerTypingEnabled = String(chatUser?.userData?.typing_indicators || "on") === "on";
  const peerVisible = String(chatUser?.userData?.profile_visibility || "public") !== "private";
  const currentUserVisible = currentUserVisibility !== "private";
  const peerAllowsAudioCalls = chatUser?.userData?.allow_audio_calls !== false;
  const peerAllowsVideoCalls = chatUser?.userData?.allow_video_calls !== false;

  const formatMessageDateLabel = useCallback((dateValue) => {
    const parsed = new Date(dateValue || Date.now());
    if (Number.isNaN(parsed.getTime())) {
      return "Today";
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const dayDiff = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Yesterday";

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const messageItems = useMemo(() => {
    const items = [];
    let previousDateLabel = "";

    messages.forEach((msg, index) => {
      const dateLabel = formatMessageDateLabel(msg?.createdAt);
      if (dateLabel !== previousDateLabel) {
        items.push({
          type: "date",
          key: `date_${dateLabel}_${index}`,
          label: dateLabel,
        });
        previousDateLabel = dateLabel;
      }

      items.push({
        type: "message",
        key: `${msg.createdAt || msg.image || msg.text || "msg"}_${index}`,
        msg,
      });
    });

    return items;
  }, [formatMessageDateLabel, messages]);

  const getOrCreateMessageRow = useCallback(async () => {
    if (!activeMessageId) return null;

    const { data, error } = await supabase
      .from("messages")
      .select("id,messages")
      .eq("id", activeMessageId)
      .limit(1);
    if (error) throw error;

    const row = data?.[0];
    if (row) return row;

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({ id: activeMessageId, messages: [] })
      .select("id,messages")
      .limit(1);
    if (insertError) throw insertError;

    return inserted?.[0] || { id: activeMessageId, messages: [] };
  }, [activeMessageId]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleOutsideClick = (event) => {
      if (
        emojiPickerRef.current?.contains(event.target) ||
        emojiButtonRef.current?.contains(event.target)
      ) {
        return;
      }
      setShowEmojiPicker(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    const chatChanged = prevActiveMessageIdRef.current !== activeMessageId;
    const nextCount = messages.length;
    const listGrew = nextCount > prevMessageCountRef.current;
    const latestMessage = nextCount > 0 ? messages[nextCount - 1] : null;
    const latestFromMe = listGrew && String(latestMessage?.sId || "") === String(userData?.id || "");

    if (chatChanged || latestFromMe || (listGrew && shouldAutoScrollRef.current)) {
      scrollToBottom();
    }

    prevActiveMessageIdRef.current = activeMessageId;
    prevMessageCountRef.current = nextCount;
  }, [activeMessageId, messages, scrollToBottom, userData?.id]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeMessageId]);

  const sendTypingSignal = useCallback(async (isTyping) => {
    if (isDesignPreviewMode) return;
    if (!activeMessageId || !userData?.id || !chatUser?.rId) return;
    if (!shouldBroadcastTyping) return;

    const channelName = `typing_${activeMessageId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "TYPING",
      payload: {
        messageId: activeMessageId,
        senderId: userData.id,
        targetId: chatUser.rId,
        isTyping,
      },
    });
    await supabase.removeChannel(channel);
  }, [activeMessageId, chatUser?.rId, shouldBroadcastTyping, userData?.id]);

  useEffect(() => {
    if (isDesignPreviewMode || !activeMessageId || !userData?.id || !chatUser?.rId) {
      setIsPeerTyping(false);
      return undefined;
    }

    setIsPeerTyping(false);
    const channel = supabase
      .channel(`typing_${activeMessageId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on("broadcast", { event: "TYPING" }, ({ payload }) => {
        if (!payload) return;
        const senderId = String(payload.senderId || "").trim();
        const targetId = String(payload.targetId || "").trim();
        if (senderId !== String(chatUser.rId || "").trim()) return;
        if (targetId && targetId !== String(userData.id || "").trim()) return;

        const nextTyping = Boolean(payload.isTyping);
        setIsPeerTyping(nextTyping && peerTypingEnabled && peerVisible);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }

        if (nextTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsPeerTyping(false);
          }, 2500);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
      setIsPeerTyping(false);
    };
  }, [activeMessageId, chatUser?.rId, peerTypingEnabled, peerVisible, userData?.id]);

  useEffect(() => () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      void sendTypingSignal(false);
    }
  }, [sendTypingSignal]);

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const onSelectEmoji = (emoji) => {
    setInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // ─── Helper: update both users' chats_data ────────────────────────────────
  const updateChatsData = async (lastMessage) => {
    const peerId = String(chatUser?.rId ?? chatUser?.rid ?? "").trim();
    const senderId = String(userData?.id || "").trim();
    if (!senderId || !peerId || !activeMessageId) return;

    const userTargets = [
      {
        id: senderId,
        peerId,
        messageSeen: true,
      },
      {
        id: peerId,
        peerId: senderId,
        messageSeen: false,
      },
    ];

    for (const target of userTargets) {
      const id = target.id;

      const { data, error } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", id)
        .limit(1);

      if (error) throw error;

      const chatRow = data?.[0];
      const chatsData = [...toMessagesArray(chatRow?.chats_data)];
      const chatIndex = chatsData.findIndex(
        (c) => {
          const rowMessageId = getMessageId(c);
          const rowPeerId = String(c?.rId ?? c?.rid ?? "").trim();
          return (
            rowMessageId === activeMessageId || (rowPeerId && rowPeerId === target.peerId)
          );
        },
      );

      const updatedEntry = {
        ...(chatIndex >= 0 ? chatsData[chatIndex] : {}),
        messageId: activeMessageId,
        rId: target.peerId,
        lastMessage,
        updatedAt: Date.now(),
        messageSeen: target.messageSeen,
      };

      if (chatIndex !== -1) {
        chatsData[chatIndex] = updatedEntry;
      } else {
        chatsData.push(updatedEntry);
      }

      if (!chatRow) {
        const { error: insertError } = await supabase
          .from("chats")
          .insert({ id, chats_data: chatsData });
        if (insertError) throw insertError;
        continue;
      }

      const { error: updateError } = await supabase
        .from("chats")
        .update({ chats_data: chatsData })
        .eq("id", id);
      if (updateError) throw updateError;
    }
  };

  // ─── Send text message ────────────────────────────────────────────────────
  const sendMessage = async () => {
    try {
      const messageText = input.trim();
      if (!messageText || !activeMessageId || !userData?.id) return;

      if (isTypingRef.current) {
        isTypingRef.current = false;
        void sendTypingSignal(false);
      }

      if (isDesignPreviewMode) {
        const next = {
          sId: userData.id,
          text: messageText,
          createdAt: new Date().toISOString(),
        };
        const chronological = [...toMessagesArray(messages), next];
        shouldAutoScrollRef.current = true;
        setMessages(chronological);
        setInput("");
        setShowEmojiPicker(false);
        return;
      }

      const currentRow = await getOrCreateMessageRow();

      const updatedMessages = [
        ...toMessagesArray(currentRow?.messages),
        {
          sId: userData.id,
          text: messageText,
          createdAt: new Date().toISOString(),
        },
      ];

      const { error: updateError } = await supabase
        .from("messages")
        .update({ messages: updatedMessages })
        .eq("id", activeMessageId);
      if (updateError) throw updateError;

      shouldAutoScrollRef.current = true;
      setMessages([...(updatedMessages || [])]);

      await updateChatsData(messageText.slice(0, 30));
      setInput("");
      setShowEmojiPicker(false);
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Send image ───────────────────────────────────────────────────────────
  const sendImage = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      if (isDesignPreviewMode) {
        const localUrl = URL.createObjectURL(file);
        const next = {
          sId: userData.id,
          image: localUrl,
          createdAt: new Date().toISOString(),
        };
        const chronological = [...toMessagesArray(messages), next];
        shouldAutoScrollRef.current = true;
        setMessages(chronological);
        return;
      }

      const fileUrl = await upload(file);
      if (!fileUrl || !activeMessageId) return;

      const currentRow = await getOrCreateMessageRow();

      const updatedMessages = [
        ...toMessagesArray(currentRow?.messages),
        {
          sId: userData.id,
          image: fileUrl,
          createdAt: new Date().toISOString(),
        },
      ];

      const { error: updateError } = await supabase
        .from("messages")
        .update({ messages: updatedMessages })
        .eq("id", activeMessageId);
      if (updateError) throw updateError;

      shouldAutoScrollRef.current = true;
      setMessages([...(updatedMessages || [])]);

      await updateChatsData("image");
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    } finally {
      e.target.value = "";
    }
  };

  // ─── Format timestamp ─────────────────────────────────────────────────────
  const convertTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, "0");
    return hour >= 12
      ? `${hour === 12 ? 12 : hour - 12}:${minute} PM`
      : `${hour}:${minute} AM`;
  };

  // ─── Realtime messages subscription ──────────────────────────────────────
  useEffect(() => {
    if (isDesignPreviewMode) return;

    if (!activeMessageId) {
      setMessages([]);
      prevActiveMessageIdRef.current = "";
      prevMessageCountRef.current = 0;
      return;
    }

    let isActive = true;
    let pollingId;

    const syncMessages = async () => {
      try {
        const row = await getOrCreateMessageRow();
        if (!isActive) return;
        updateMessagesIfChanged(toMessagesArray(row?.messages));
      } catch (error) {
        if (!isActive) return;
        console.warn("syncMessages error:", error?.message || error);
      }
    };

    void syncMessages();
    pollingId = setInterval(syncMessages, 3000);

    const channel = supabase
      .channel(`messages_${activeMessageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `id=eq.${activeMessageId}`,
        },
        (payload) => {
          if (!isActive) return;
          const nextMessages = payload?.new?.messages;
          if (Array.isArray(nextMessages)) {
            updateMessagesIfChanged(nextMessages);
          } else {
            void syncMessages();
          }
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      clearInterval(pollingId);
      supabase.removeChannel(channel);
    };
  }, [activeMessageId, setMessages, getOrCreateMessageRow, updateMessagesIfChanged]);

  const isOnline = isUserOnline(chatUser?.userData);

  const toggleMyVisibility = async () => {
    const nextVisibility = currentUserVisible ? "private" : "public";
    const result = await updateCurrentUserPreferences({
      profile_visibility: nextVisibility,
    });

    if (!result?.ok) {
      notificationHelper.error("Unable to update visibility right now.");
      return;
    }

    notificationHelper.success(
      nextVisibility === "private"
        ? "You are now hidden (offline)."
        : "You are now visible (online).",
    );
  };

  return chatUser ? (
    <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
      <div className="chat-user">
        <img src={chatUserAvatar} alt="" />
        <div className="chat-user-meta">
          <p>{chatUser.userData.name}</p>
          <span className={`presence ${isOnline ? "online" : "away"}`}>
            {isPeerTyping ? "Typing..." : isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <div className="chat-user-actions">
          <button
            type="button"
            className="icon-btn call-btn"
            title="Audio Call"
            aria-label="Audio Call"
            disabled={!isOnline || !peerAllowsAudioCalls}
            onClick={() => {
              const targetId = chatUser?.userData?.id || chatUser?.rId;
              if (!targetId) {
                notificationHelper.error("Select a valid chat user before starting a call.");
                return;
              }
              if (!peerAllowsAudioCalls) {
                notificationHelper.error("User has disabled audio calls.");
                return;
              }
              if (!isOnline) {
                notificationHelper.error("User is offline. Calls are available only when user is online.");
                return;
              }
              void initiateCall(targetId, false, "audio");
            }}
          >
            📞
          </button>
          <button
            type="button"
            className="icon-btn video-btn"
            title="Video Call"
            aria-label="Video Call"
            disabled={!isOnline || !peerAllowsVideoCalls}
            onClick={() => {
              const targetId = chatUser?.userData?.id || chatUser?.rId;
              if (!targetId) {
                notificationHelper.error("Select a valid chat user before starting a call.");
                return;
              }
              if (!peerAllowsVideoCalls) {
                notificationHelper.error("User has disabled video calls.");
                return;
              }
              if (!isOnline) {
                notificationHelper.error("User is offline. Calls are available only when user is online.");
                return;
              }
              void initiateCall(targetId, false);
            }}
          >
            🎥
          </button>
          <button
            type="button"
            className="icon-btn info-btn"
            title="Info"
            aria-label="Info"
            onClick={() => setChatInfoPanelOpen((prev) => !prev)}
          >
            ℹ️
          </button>
          <button
            type="button"
            className="icon-btn info-btn"
            title={currentUserVisible ? "Go invisible" : "Go visible"}
            aria-label={currentUserVisible ? "Go invisible" : "Go visible"}
            onClick={toggleMyVisibility}
          >
            {currentUserVisible ? "👁️" : "🙈"}
          </button>
        </div>
        <img
          onClick={() => setChatVisible(false)}
          src={assets.arrow_icon}
          className="arrow"
          alt=""
        />
      </div>

      <div
        className="chat-msg"
        ref={chatMessagesRef}
        onScroll={() => {
          shouldAutoScrollRef.current = isNearBottom();
        }}
      >
        {messageItems.map((item) => {
          if (item.type === "date") {
            return (
              <div key={item.key} className="chat-date-separator">
                <span>{item.label}</span>
              </div>
            );
          }

          const msg = item.msg;
          return (
            <div
              key={item.key}
              className={msg.sId === userData.id ? "s-msg" : "r-msg"}
            >
              {msg.image ? (
                <img
                  className="msg-img"
                  src={msg.image}
                  alt=""
                  onLoad={() => {
                    if (shouldAutoScrollRef.current) {
                      scrollToBottom();
                    }
                  }}
                />
              ) : (
                <p className="msg">{msg.text}</p>
              )}
              <div>
                <img
                  src={
                    msg.sId === userData.id
                      ? currentUserAvatar
                      : chatUserAvatar
                  }
                  alt=""
                />
                <p>{convertTimestamp(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="chat-input">
        {!currentUserTypingEnabled ? (
          <span className="typing-disabled-hint">Typing indicators are off</span>
        ) : null}
        <button
          type="button"
          className="input-icon"
          onClick={openImagePicker}
          title="Add image"
        >
          +
        </button>
        <input
          ref={messageInputRef}
          onChange={(e) => {
            const nextValue = e.target.value;
            setInput(nextValue);

            if (!shouldBroadcastTyping) return;

            const nextIsTyping = nextValue.trim().length > 0;
            if (nextIsTyping !== isTypingRef.current) {
              isTypingRef.current = nextIsTyping;
              void sendTypingSignal(nextIsTyping);
            }
          }}
          value={input}
          type="text"
          placeholder="Send a message"
          onBlur={() => {
            if (!isTypingRef.current) return;
            isTypingRef.current = false;
            void sendTypingSignal(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void sendMessage();
            }
          }}
        />
        <input
          ref={imageInputRef}
          onChange={sendImage}
          type="file"
          id="image"
          accept="image/png, image/jpeg"
          hidden
        />
        <label htmlFor="image" className="input-icon" title="Add image">
          <img src={assets.gallery_icon} alt="" />
        </label>
        <button
          ref={emojiButtonRef}
          type="button"
          className="input-icon"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          title="Emoji"
        >
          😊
        </button>
        {showEmojiPicker ? (
          <div className="emoji-picker" ref={emojiPickerRef}>
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-item"
                onClick={() => onSelectEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <img
          onClick={sendMessage}
          className="img"
          src={assets.send_button}
          alt=""
        />
      </div>
    </div>
  ) : (
    <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
      <img src={assets.logo_icon} alt="" />
      <p>Chat anytime, anywhere</p>
    </div>
  );
};

export default ChatBox;
