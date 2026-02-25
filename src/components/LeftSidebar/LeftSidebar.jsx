import React, { useContext, useEffect, useState } from "react";
import "./LeftSidebar.css";
import assets from "../../assets/assets";
import { useNavigate } from "react-router-dom";
import { supabase, toUserErrorMessage } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { toast } from "react-toastify";

const LeftSidebar = () => {
  const navigate = useNavigate();
  const {
    userData,
    chatData,
    chatUser,
    setChatUser,
    setMessagesId,
    messagesId,
    chatVisible,
    setChatVisible,
  } = useContext(AppContext);

  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const getPeerId = (item) =>
    String(
      item?.rId ?? item?.rid ?? item?.rID ?? item?.receiverId ?? item?.receiver_id ?? "",
    ).trim();
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
  const activeMessageId = getMessageId(chatUser);

  const appendChatForUser = async (targetId, entry) => {
    const { data, error } = await supabase
      .from("chats")
      .select("chats_data")
      .eq("id", targetId)
      .limit(1);

    if (error) throw error;

    const row = data?.[0];
    const currentChats = Array.isArray(row?.chats_data) ? [...row.chats_data] : [];
    const existingIndex = currentChats.findIndex(
      (chat) =>
        getMessageId(chat) === entry.messageId || getPeerId(chat) === entry.rId,
    );

    if (existingIndex === -1) {
      currentChats.push(entry);
    } else {
      currentChats[existingIndex] = {
        ...currentChats[existingIndex],
        ...entry,
      };
    }

    if (!row) {
      const { error: insertError } = await supabase
        .from("chats")
        .insert({ id: targetId, chats_data: currentChats });
      if (insertError) throw insertError;
      return;
    }

    const { error: updateError } = await supabase
      .from("chats")
      .update({ chats_data: currentChats })
      .eq("id", targetId);
    if (updateError) throw updateError;
  };

  // ─── Search user by username ──────────────────────────────────────────────
  const inputHandler = async (e) => {
    try {
      const input = e.target.value;
      setSearchTerm(input);
      if (!input) {
        setShowSearch(false);
        setUser(null);
        return;
      }

      setShowSearch(true);

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`username.ilike.%${input}%,name.ilike.%${input}%`)
        .limit(10);

      if (error || !data?.length) {
        setUser(null);
        return;
      }

      // show the first user who is not me and not already in chats
      const candidate = data.find(
        (item) =>
          item.id !== userData.id &&
          !chatData.some((chat) => getPeerId(chat) === item.id),
      );
      setUser(candidate || null);
    } catch (error) {
      toast.error(toUserErrorMessage(error));
    }
  };

  // ─── Add new chat ─────────────────────────────────────────────────────────
  const addChat = async () => {
    try {
      if (!user?.id || !userData?.id) return;

      const existingChat = chatData.find((chat) => getPeerId(chat) === user.id);
      if (existingChat) {
        await setChat(existingChat);
        setShowSearch(false);
        return;
      }

      // Create new messages row
      const { data: newMsg, error: msgError } = await supabase
        .from("messages")
        .insert({ messages: [] })
        .select()
        .single();

      if (msgError) throw msgError;

      const newMessageId = newMsg.id;

      // Both rows must be updated; if remote update fails, chat won't appear to recipient.
      await appendChatForUser(userData.id, {
        messageId: newMessageId,
        lastMessage: "",
        rId: user.id,
        updatedAt: Date.now(),
        messageSeen: true,
      });
      await appendChatForUser(user.id, {
        messageId: newMessageId,
        lastMessage: "",
        rId: userData.id,
        updatedAt: Date.now(),
        messageSeen: true,
      });

      // Open this new chat immediately
      setChat({
        messageId: newMessageId,
        lastMessage: "",
        rId: user.id,
        updatedAt: Date.now(),
        messageSeen: true,
        userData: user,
      });

      setShowSearch(false);
      setChatVisible(true);
    } catch (error) {
      toast.error(toUserErrorMessage(error));
    }
  };

  // ─── Open a chat and mark as seen ────────────────────────────────────────
  const setChat = async (item) => {
    try {
      const normalizedItem = {
        ...item,
        rId: getPeerId(item),
        messageId: getMessageId(item),
      };

      if (!normalizedItem.rId || !normalizedItem.messageId) {
        toast.error("Corrupt chat record. Missing chat/message id.");
        return;
      }

      setMessagesId(normalizedItem.messageId);
      setChatUser(normalizedItem);

      // Mark as seen
      const { data: chatRows } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", userData.id)
        .limit(1);

      const chatRow = chatRows?.[0];
      if (!chatRow) {
        await supabase.from("chats").upsert({ id: userData.id, chats_data: [] });
        setChatVisible(true);
        return;
      }

      const chatsData = [...(chatRow?.chats_data || [])];
      const chatIndex = chatsData.findIndex(
        (c) => getMessageId(c) === normalizedItem.messageId,
      );

      if (chatIndex !== -1) {
        chatsData[chatIndex].messageSeen = true;
        await supabase
          .from("chats")
          .update({ chats_data: chatsData })
          .eq("id", userData.id);
      }

      setChatVisible(true);
    } catch (error) {
      toast.error(toUserErrorMessage(error));
    }
  };

  // Keep selected chat metadata in sync when sidebar data refreshes.
  useEffect(() => {
    if (!activeMessageId) return;

    const latestChat = chatData.find(
      (item) => getMessageId(item) === activeMessageId,
    );
    if (!latestChat?.userData) return;

    setChatUser((prev) => {
      if (!prev) return prev;
      const prevUser = prev.userData || {};
      const nextUser = latestChat.userData || {};

      const unchanged =
        prevUser.id === nextUser.id &&
        prevUser.name === nextUser.name &&
        prevUser.avatar === nextUser.avatar &&
        prevUser.bio === nextUser.bio &&
        Number(prevUser.last_seen || 0) === Number(nextUser.last_seen || 0) &&
        getPeerId(prev) === getPeerId(latestChat);

      if (unchanged) return prev;

      return {
        ...prev,
        rId: getPeerId(latestChat),
        messageId: getMessageId(latestChat),
        userData: nextUser,
        lastMessage: latestChat.lastMessage,
        updatedAt: latestChat.updatedAt,
        messageSeen: latestChat.messageSeen,
      };
    });
  }, [activeMessageId, chatData, setChatUser]);

  return (
    <div className={`ls ${chatVisible ? "hidden" : ""}`}>
      <div className="ls-top">
        <div className="ls-nav">
          <img src={assets.logo} className="logo" alt="" />
          <div className="menu">
            <img src={assets.menu_icon} alt="" />
            <div className="sub-menu">
              <p onClick={() => navigate("/profile-update")}>Edit Profile</p>
              <hr />
              <p onClick={async () => await supabase.auth.signOut()}>Logout</p>
            </div>
          </div>
        </div>
        <div className="ls-search">
          <img src={assets.search_icon} alt="" />
          <input
            onChange={inputHandler}
            value={searchTerm}
            type="text"
            placeholder="Search by username or name"
          />
        </div>
      </div>

      <div className="ls-list">
        {showSearch && user ? (
          <div onClick={addChat} className="friends add-user">
            <img src={user.avatar || assets.avatar_icon} alt="" />
            <p>{user.name}</p>
          </div>
        ) : (
          chatData.map((item, index) => (
            <div
              onClick={() => setChat(item)}
              key={getMessageId(item) || `${getPeerId(item)}_${index}`}
              className={`friends ${
                item.messageSeen || getMessageId(item) === messagesId
                  ? ""
                  : "border"
              }`}
            >
              <img src={item.userData.avatar || assets.avatar_icon} alt="" />
              <div>
                <p>{item.userData.name}</p>
                <span>{item.lastMessage}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;
