import React, { useContext, useEffect, useRef, useState } from "react";
import "./LeftSidebar.css";
import assets from "../../assets/assets";
import { useLocation, useNavigate } from "react-router-dom";
import {
  isDesignPreviewMode,
  supabase,
  toUserErrorMessage,
} from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { notificationHelper } from "../../lib/notificationManager";

const LeftSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    userData,
    chatData,
    chatUser,
    setChatUser,
    setMessagesId,
    messagesId,
    chatVisible,
    setChatVisible,
    setMessages,
    isUserOnline,
  } = useContext(AppContext);

  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchDebounceRef = useRef(null);
  const latestSearchTokenRef = useRef(0);

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
  const isMessagesRoute = location.pathname === "/chat";

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

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }

      if (isDesignPreviewMode) {
        setShowSearch(false);
        setUser(null);
        return;
      }

      if (!input) {
        setShowSearch(false);
        setUser(null);
        return;
      }

      const trimmedInput = input.trim();
      if (trimmedInput.length < 2) {
        setShowSearch(false);
        setUser(null);
        return;
      }

      setShowSearch(true);

      const token = Date.now();
      latestSearchTokenRef.current = token;

      searchDebounceRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .or(`username.ilike.%${trimmedInput}%,name.ilike.%${trimmedInput}%`)
            .limit(10);

          if (latestSearchTokenRef.current !== token) return;

          if (error || !data?.length) {
            setUser(null);
            return;
          }

          const candidate = data.find(
            (item) =>
              item.id !== userData.id &&
              !chatData.some((chat) => getPeerId(chat) === item.id),
          );
          setUser(candidate || null);
        } catch (error) {
          if (latestSearchTokenRef.current === token) {
            notificationHelper.error(toUserErrorMessage(error));
          }
        }
      }, 300);
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // ─── Add new chat ─────────────────────────────────────────────────────────
  const addChat = async () => {
    try {
      if (isDesignPreviewMode) {
        notificationHelper.info("Search/add chat is disabled in design preview mode.");
        return;
      }

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
      notificationHelper.error(toUserErrorMessage(error));
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

      if (isDesignPreviewMode) {
        setMessagesId(normalizedItem.messageId);
        setChatUser(normalizedItem);
        setMessages([...(normalizedItem.previewMessages || [])].reverse());
        setChatVisible(true);
        return;
      }

      if (!normalizedItem.rId || !normalizedItem.messageId) {
        notificationHelper.error("Corrupt chat record. Missing chat/message id.");
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
      notificationHelper.error(toUserErrorMessage(error));
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
          <img src="/logo-full.svg" className="logo" alt="" />
        </div>
        <button
          className="new-message-btn"
          onClick={() => notificationHelper.info("Feature coming soon")}
        >
          + New Message
        </button>
        <div className="ls-mini-links">
          <p
            className={isMessagesRoute ? "active" : ""}
            onClick={() => navigate("/chat")}
          >
            Messages
          </p>
          <p onClick={() => notificationHelper.info("Feature coming soon")}>Contacts</p>
          <p onClick={() => navigate("/profile-update")}>Settings</p>
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
          chatData.map((item, index) => {
            const online = isUserOnline(item.userData);
            return (
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
                <span className={`friend-status ${online ? "online" : "offline"}`}>
                  {online ? "Online" : "Offline"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;
