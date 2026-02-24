import React, { useContext, useEffect, useState } from "react";
import "./ChatBox.css";
import assets from "../../assets/assets";
import { AppContext } from "../../context/AppContextObject";
import { supabase } from "../../config/supabase";
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── Helper: update both users' chats_data ────────────────────────────────
  const updateChatsData = async (lastMessage) => {
    const userIds = [chatUser.rId, userData.id];

    for (const id of userIds) {
      const { data: chatRow } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", id)
        .single();

      if (!chatRow) continue;

      const chatsData = [...chatRow.chats_data];
      const chatIndex = chatsData.findIndex((c) => c.messageId === messagesId);

      if (chatIndex !== -1) {
        chatsData[chatIndex].lastMessage = lastMessage;
        chatsData[chatIndex].updatedAt = Date.now();
        if (chatsData[chatIndex].rId === userData.id) {
          chatsData[chatIndex].messageSeen = false;
        }

        await supabase
          .from("chats")
          .update({ chats_data: chatsData })
          .eq("id", id);
      }
    }
  };

  // ─── Send text message ────────────────────────────────────────────────────
  const sendMessage = async () => {
    try {
      if (!input || !messagesId) return;

      const { data: msgRow } = await supabase
        .from("messages")
        .select("messages")
        .eq("id", messagesId)
        .single();

      const updatedMessages = [
        ...(msgRow?.messages || []),
        {
          sId: userData.id,
          text: input,
          createdAt: new Date().toISOString(),
        },
      ];

      await supabase
        .from("messages")
        .update({ messages: updatedMessages })
        .eq("id", messagesId);

      await updateChatsData(input.slice(0, 30));
    } catch (error) {
      console.error(error.message);
    }
    setInput("");
  };

  // ─── Send image ───────────────────────────────────────────────────────────
  const sendImage = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileUrl = await upload(file);
      if (!fileUrl || !messagesId) return;

      const { data: msgRow } = await supabase
        .from("messages")
        .select("messages")
        .eq("id", messagesId)
        .single();

      const updatedMessages = [
        ...(msgRow?.messages || []),
        {
          sId: userData.id,
          image: fileUrl,
          createdAt: new Date().toISOString(),
        },
      ];

      await supabase
        .from("messages")
        .update({ messages: updatedMessages })
        .eq("id", messagesId);

      await updateChatsData("image");
    } catch (error) {
      toast.error(error.message);
    } finally {
      e.target.value = "";
    }
  };

  // ─── Format timestamp ─────────────────────────────────────────────────────
  const convertTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, "0");
    return hour >= 12
      ? `${hour === 12 ? 12 : hour - 12}:${minute} PM`
      : `${hour}:${minute} AM`;
  };

  // ─── Realtime messages subscription ──────────────────────────────────────
  useEffect(() => {
    if (!messagesId) return;

    // Initial load
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("messages")
        .eq("id", messagesId)
        .single();

      if (data) setMessages([...(data.messages || [])].reverse());
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages_${messagesId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `id=eq.${messagesId}`,
        },
        (payload) => {
          setMessages([...(payload.new.messages || [])].reverse());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messagesId, setMessages]);

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
            key={index}
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
