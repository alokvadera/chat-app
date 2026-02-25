import React, { useCallback, useContext, useEffect, useState } from "react";
import "./ChatBox.css";
import assets from "../../assets/assets";
import { AppContext } from "../../context/AppContextObject";
import { supabase, toUserErrorMessage } from "../../config/supabase";
import upload from "../../lib/upload";
import { toast } from "react-toastify";

const ChatBox = () => {
  const {
    userData,
    messagesId,
    chatUser,
    messages,
    setMessages,
    chatVisible,
    setChatVisible,
  } = useContext(AppContext);

  const [input, setInput] = useState("");
  const [now, setNow] = useState(() => Date.now());
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
  const chatMessagesId = getMessageId(chatUser);
  const activeMessageId = String(messagesId || chatMessagesId || "").trim();

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
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

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

      setMessages([...(updatedMessages || [])].reverse());

      await updateChatsData(messageText.slice(0, 30));
      setInput("");
    } catch (error) {
      toast.error(toUserErrorMessage(error));
    }
  };

  // ─── Send image ───────────────────────────────────────────────────────────
  const sendImage = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

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

      setMessages([...(updatedMessages || [])].reverse());

      await updateChatsData("image");
    } catch (error) {
      toast.error(toUserErrorMessage(error));
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
    if (!activeMessageId) {
      setMessages([]);
      return;
    }

    let isActive = true;
    let pollingId;

    const syncMessages = async () => {
      try {
        const row = await getOrCreateMessageRow();
        if (!isActive) return;
        setMessages([...(toMessagesArray(row?.messages) || [])].reverse());
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
            setMessages([...(nextMessages || [])].reverse());
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
  }, [activeMessageId, setMessages, getOrCreateMessageRow]);

  const isOnline =
    now - (chatUser?.userData?.last_seen ? Number(chatUser.userData.last_seen) : 0) <=
    70000;

  return chatUser ? (
    <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
      <div className="chat-user">
        <img src={chatUserAvatar} alt="" />
        <p>
          {chatUser.userData.name}{" "}
          {isOnline ? (
            <img className="dot" src={assets.green_dot} alt="" />
          ) : null}
        </p>
        <img src={assets.help_icon} className="help" alt="info" />
        <img
          onClick={() => setChatVisible(false)}
          src={assets.arrow_icon}
          className="arrow"
          alt=""
        />
      </div>

      <div className="chat-msg">
        {messages.map((msg, index) => (
          <div
            key={`${msg.createdAt || msg.image || msg.text || "msg"}_${index}`}
            className={msg.sId === userData.id ? "s-msg" : "r-msg"}
          >
            {msg.image ? (
              <img className="msg-img" src={msg.image} alt="" />
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
        ))}
      </div>

      <div className="chat-input">
        <input
          onChange={(e) => setInput(e.target.value)}
          value={input}
          type="text"
          placeholder="Send a message"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <input
          onChange={sendImage}
          type="file"
          id="image"
          accept="image/png, image/jpeg"
          hidden
        />
        <label htmlFor="image">
          <img src={assets.gallery_icon} alt="" />
        </label>
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
