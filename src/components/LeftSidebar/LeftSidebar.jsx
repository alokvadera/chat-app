import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
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
import { getUnreadCount } from "../../lib/messageUtils";
import {
  requestNotificationPermission,
  isNotificationEnabled,
  setNotificationEnabled,
} from "../../lib/pushNotifications";

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
    presenceUsers,
  } = useContext(AppContext);

  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [chatOptionsMenu, setChatOptionsMenu] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchDebounceRef = useRef(null);
  const latestSearchTokenRef = useRef(0);
  const searchInputRef = useRef(null);

  const getPeerId = (item) =>
    String(item?.rId ?? item?.rid ?? item?.rID ?? item?.receiverId ?? item?.receiver_id ?? "").trim();
  const getMessageId = (item) =>
    String(item?.messageId ?? item?.messagesId ?? item?.messageid ?? item?.messagesid ?? item?.message_id ?? item?.messages_id ?? "").trim();
  const activeMessageId = getMessageId(chatUser);
  const isMessagesRoute = location.pathname === "/chat";

  // Total unread count
  const totalUnread = useMemo(() =>
    chatData.reduce((sum, item) => sum + getUnreadCount(item), 0),
  [chatData]);

  // Format last seen time
  const formatLastSeen = (user) => {
    if (!user) return "";
    const lastSeen = Number(user.last_seen || 0);
    if (!lastSeen) return "";
    const diff = Date.now() - lastSeen;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(lastSeen).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const appendChatForUser = async (targetId, entry) => {
    const { data, error } = await supabase
      .from("chats").select("chats_data").eq("id", targetId).limit(1);
    if (error) throw error;

    const row = data?.[0];
    const currentChats = Array.isArray(row?.chats_data) ? [...row.chats_data] : [];
    const existingIndex = currentChats.findIndex(
      (chat) => getMessageId(chat) === entry.messageId || getPeerId(chat) === entry.rId,
    );

    if (existingIndex === -1) {
      currentChats.push(entry);
    } else {
      currentChats[existingIndex] = { ...currentChats[existingIndex], ...entry };
    }

    if (!row) {
      const { error: insertError } = await supabase
        .from("chats").insert({ id: targetId, chats_data: currentChats });
      if (insertError) throw insertError;
      return;
    }
    const { error: updateError } = await supabase
      .from("chats").update({ chats_data: currentChats }).eq("id", targetId);
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

      if (isDesignPreviewMode) { setShowSearch(false); setUser(null); return; }
      if (!input) { setShowSearch(false); setUser(null); return; }
      const trimmedInput = input.trim();
      if (trimmedInput.length < 2) { setShowSearch(false); setUser(null); return; }

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
          if (error || !data?.length) { setUser(null); return; }

          const candidate = data.find(
            (item) => item.id !== userData.id && !chatData.some((chat) => getPeerId(chat) === item.id),
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

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if (userData?.id && !isDesignPreviewMode) {
      requestNotificationPermission();
    }
  }, [userData?.id]);

  // ─── Add new chat ─────────────────────────────────────────────────────────
  const addChat = async () => {
    try {
      if (isDesignPreviewMode) {
        notificationHelper.info("Disabled in preview mode.");
        return;
      }
      if (!user?.id || !userData?.id) return;

      const existingChat = chatData.find((chat) => getPeerId(chat) === user.id);
      if (existingChat) { await setChat(existingChat); setShowSearch(false); return; }

      const { data: newMsg, error: msgError } = await supabase
        .from("messages").insert({ messages: [] }).select().single();
      if (msgError) throw msgError;

      const newMessageId = newMsg.id;
      await appendChatForUser(userData.id, {
        messageId: newMessageId, lastMessage: "", rId: user.id, updatedAt: Date.now(), messageSeen: true, unreadCount: 0,
      });
      await appendChatForUser(user.id, {
        messageId: newMessageId, lastMessage: "", rId: userData.id, updatedAt: Date.now(), messageSeen: true, unreadCount: 0,
      });

      setChat({
        messageId: newMessageId, lastMessage: "", rId: user.id,
        updatedAt: Date.now(), messageSeen: true, unreadCount: 0, userData: user,
      });
      setShowSearch(false);
      setChatVisible(true);
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Create group chat ───────────────────────────────────────────────
  const createGroupChat = async () => {
    try {
      if (creatingGroup) return;
      if (!groupName.trim() || selectedMembers.length === 0) {
        notificationHelper.error("Enter group name and select at least one member.");
        return;
      }
      if (isDesignPreviewMode) {
        notificationHelper.info("Disabled in preview mode.");
        return;
      }

      setCreatingGroup(true);

      const { data: newMsg, error: msgError } = await supabase
        .from("messages").insert({ messages: [] }).select().single();
      if (msgError) throw msgError;

      const newMessageId = newMsg.id;
      const allMembers = [userData.id, ...selectedMembers.map((m) => m.id)];

      // Add group chat entry to each member's chats_data
      for (const memberId of allMembers) {
        await appendChatForUser(memberId, {
          messageId: newMessageId,
          lastMessage: "",
          rId: newMessageId,
          updatedAt: Date.now(),
          messageSeen: true,
          unreadCount: 0,
          isGroup: true,
          groupName: groupName.trim(),
          groupAvatar: "",
          groupMembers: allMembers,
          createdBy: userData.id,
        });
      }

      setShowNewGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      setCreatingGroup(false);
      notificationHelper.success(`Group "${groupName.trim()}" created!`);
    } catch (error) {
      setCreatingGroup(false);
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Open a chat and mark as seen + reset unread ───────────────────────
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
        notificationHelper.error("Corrupt chat record.");
        return;
      }

      setMessagesId(normalizedItem.messageId);
      setChatUser(normalizedItem);

      // Mark as seen and reset unread count
      const { data: chatRows } = await supabase
        .from("chats").select("chats_data").eq("id", userData.id).limit(1);

      const chatRow = chatRows?.[0];
      if (!chatRow) {
        await supabase.from("chats").upsert({ id: userData.id, chats_data: [] });
        setChatVisible(true);
        return;
      }

      const chatsData = [...(chatRow?.chats_data || [])];
      const chatIndex = chatsData.findIndex((c) => getMessageId(c) === normalizedItem.messageId);

      if (chatIndex !== -1) {
        chatsData[chatIndex].messageSeen = true;
        chatsData[chatIndex].unreadCount = 0;
        await supabase.from("chats").update({ chats_data: chatsData }).eq("id", userData.id);
      }

      setChatVisible(true);
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Remove 1:1 chat from current user's list ────────────────────────
  const removeChatForMe = async (item) => {
    try {
      if (isDesignPreviewMode) { notificationHelper.info("Disabled in preview mode."); return; }
      const msgId = getMessageId(item);
      if (!msgId || !userData?.id) return;

      const { data: chatRows } = await supabase
        .from("chats").select("chats_data").eq("id", userData.id).limit(1);
      const chatRow = chatRows?.[0];
      if (!chatRow) return;

      const updated = (chatRow.chats_data || []).filter(
        (c) => getMessageId(c) !== msgId,
      );
      await supabase.from("chats").update({ chats_data: updated }).eq("id", userData.id);

      if (messagesId === msgId) {
        setChatUser(null);
        setMessagesId("");
        setMessages([]);
        setChatVisible(false);
      }
      notificationHelper.success("Chat removed.");
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Leave group: remove self + update other members' groupMembers ────
  const leaveGroup = async (item) => {
    try {
      if (isDesignPreviewMode) { notificationHelper.info("Disabled in preview mode."); return; }
      const msgId = getMessageId(item);
      if (!msgId || !userData?.id) return;

      const members = (item.groupMembers || []).filter((id) => id !== userData.id);

      // Remove group from current user's chats_data
      const { data: myRows } = await supabase
        .from("chats").select("chats_data").eq("id", userData.id).limit(1);
      const myRow = myRows?.[0];
      if (myRow) {
        const updated = (myRow.chats_data || []).filter((c) => getMessageId(c) !== msgId);
        await supabase.from("chats").update({ chats_data: updated }).eq("id", userData.id);
      }

      // Remove current user from groupMembers in remaining members' data
      await Promise.allSettled(
        members.map(async (memberId) => {
          const { data: rows } = await supabase
            .from("chats").select("chats_data").eq("id", memberId).limit(1);
          const row = rows?.[0];
          if (!row) return;
          const chats = (row.chats_data || []).map((c) => {
            if (getMessageId(c) !== msgId) return c;
            return {
              ...c,
              groupMembers: (c.groupMembers || []).filter((id) => id !== userData.id),
            };
          });
          await supabase.from("chats").update({ chats_data: chats }).eq("id", memberId);
        }),
      );

      if (messagesId === msgId) {
        setChatUser(null);
        setMessagesId("");
        setMessages([]);
        setChatVisible(false);
      }
      notificationHelper.success(`Left "${item.groupName || "Group"}".`);
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Delete group for everyone (creator only) ─────────────────────────
  const deleteGroupForEveryone = async (item) => {
    try {
      if (isDesignPreviewMode) { notificationHelper.info("Disabled in preview mode."); return; }
      const msgId = getMessageId(item);
      if (!msgId) return;

      if (item.createdBy && item.createdBy !== userData?.id) {
        notificationHelper.error("Only the group creator can delete this group.");
        return;
      }

      // Ensure current user is included in cleanup
      const members = item.groupMembers || [];
      const allIds = [...new Set([...members, userData.id])];

      // Remove group entry from every member's chats_data in parallel
      await Promise.allSettled(
        allIds.map(async (memberId) => {
          const { data: rows } = await supabase
            .from("chats").select("chats_data").eq("id", memberId).limit(1);
          const row = rows?.[0];
          if (!row) return;
          const updated = (row.chats_data || []).filter((c) => getMessageId(c) !== msgId);
          await supabase.from("chats").update({ chats_data: updated }).eq("id", memberId);
        }),
      );

      await supabase.from("messages").delete().eq("id", msgId);

      if (messagesId === msgId) {
        setChatUser(null);
        setMessagesId("");
        setMessages([]);
        setChatVisible(false);
      }
      notificationHelper.success("Group deleted for everyone.");
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // Close options menu when clicking outside
  useEffect(() => {
    if (!chatOptionsMenu) return;
    const handler = (e) => {
      if (!e.target.closest(".chat-options-menu") && !e.target.closest(".chat-options-btn")) {
        setChatOptionsMenu(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [chatOptionsMenu]);

  // Keep selected chat in sync
  useEffect(() => {
    if (!activeMessageId) return;
    const latestChat = chatData.find((item) => getMessageId(item) === activeMessageId);
    if (!latestChat?.userData) return;

    setChatUser((prev) => {
      if (!prev) return prev;
      const prevUser = prev.userData || {};
      const nextUser = latestChat.userData || {};
      const unchanged =
        prevUser.id === nextUser.id && prevUser.name === nextUser.name &&
        prevUser.avatar === nextUser.avatar && prevUser.bio === nextUser.bio &&
        Number(prevUser.last_seen || 0) === Number(nextUser.last_seen || 0) &&
        getPeerId(prev) === getPeerId(latestChat);
      if (unchanged) return prev;
      return {
        ...prev, rId: getPeerId(latestChat), messageId: getMessageId(latestChat),
        userData: nextUser, lastMessage: latestChat.lastMessage,
        updatedAt: latestChat.updatedAt, messageSeen: latestChat.messageSeen,
      };
    });
  }, [activeMessageId, chatData, setChatUser]);

  return (
    <div className={`ls ${chatVisible ? "hidden" : ""}`}>
      <div className="ls-top">
        <div className="ls-nav">
          <img src="/logo-full.svg" className="logo" alt="" />
          {totalUnread > 0 ? <span className="total-unread-badge">{totalUnread}</span> : null}
        </div>
        <div className="ls-action-row">
          <button className="new-message-btn" onClick={() => { setShowNewGroup(false); searchInputRef.current?.focus(); }}>
            + New Message
          </button>
          <button className="new-group-btn" onClick={() => setShowNewGroup((p) => !p)} title="New group">
            👥
          </button>
        </div>
        <div className="ls-mini-links">
          <p className={isMessagesRoute ? "active" : ""} onClick={() => navigate("/chat")}>Messages</p>
          <p onClick={() => notificationHelper.info("Feature coming soon")}>Contacts</p>
          <p onClick={() => navigate("/profile-update")}>Settings</p>
        </div>
        <div className="ls-search">
          <img src={assets.search_icon} alt="" />
          <input ref={searchInputRef} onChange={inputHandler} value={searchTerm} type="text" placeholder="Search by username or name" />
        </div>
      </div>

      {/* New group form */}
      {showNewGroup ? (
        <div className="new-group-form">
          <div className="group-form-header">
            <span className="group-form-title">Create Group</span>
            <button type="button" className="group-form-close" onClick={() => { setShowNewGroup(false); setSelectedMembers([]); setGroupName(""); }}>✕</button>
          </div>
          <input type="text" placeholder="Group name" value={groupName}
            onChange={(e) => setGroupName(e.target.value)} className="group-name-input" />
          {selectedMembers.length > 0 ? (
            <div className="group-selected-chips">
              {selectedMembers.map((m) => (
                <span key={m.id} className="member-chip">
                  <img src={m.avatar || assets.avatar_icon} alt="" />
                  {m.name?.split(' ')[0] || 'User'}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedMembers((prev) => prev.filter((p) => p.id !== m.id)); }}>✕</button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="group-member-list">
            <p className="group-form-label">Add members</p>
            {chatData.filter((item) => !item.isGroup).map((item) => {
              const isSelected = selectedMembers.some((m) => m.id === item.userData?.id);
              return (
                <div key={getPeerId(item)} className={`group-member-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    if (!item.userData?.id) return;
                    setSelectedMembers((prev) =>
                      isSelected ? prev.filter((m) => m.id !== item.userData.id) : [...prev, item.userData]
                    );
                  }}>
                  <img src={item.userData?.avatar || assets.avatar_icon} alt="" />
                  <span>{item.userData?.name || "Unknown"}</span>
                  {isSelected ? <span className="check-mark">✓</span> : null}
                </div>
              );
            })}
          </div>
          <div className="group-form-actions">
            <button type="button" onClick={createGroupChat} className="create-group-btn" disabled={creatingGroup}>
              {creatingGroup ? "Creating..." : "Create Group"}
            </button>
            <button type="button" onClick={() => { setShowNewGroup(false); setSelectedMembers([]); setGroupName(""); }} className="cancel-group-btn" disabled={creatingGroup}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="ls-list">
        {showSearch && user ? (
          <div onClick={addChat} className="friends add-user">
            <img src={user.avatar || assets.avatar_icon} alt="" />
            <p>{user.name}</p>
          </div>
        ) : (
          chatData.map((item, index) => {
            const online = isUserOnline(item.userData);
            const unread = getUnreadCount(item);
            const isGroup = Boolean(item.isGroup);
            const displayName = isGroup ? (item.groupName || "Group") : (item.userData?.name || "Unknown");
            const displayAvatar = isGroup ? (item.groupAvatar || assets.avatar_icon) : (item.userData?.avatar || assets.avatar_icon);
            const isActive = getMessageId(item) === messagesId;
            const itemMsgId = getMessageId(item);
            const isMenuOpen = chatOptionsMenu === itemMsgId;

            return (
              <div
                onClick={() => setChat(item)}
                key={itemMsgId || `${getPeerId(item)}_${index}`}
                className={`friends ${isActive ? "active" : ""} ${unread > 0 ? "has-unread" : ""}`}
              >
                <div className="friend-avatar-wrap">
                  <img src={displayAvatar} alt="" />
                  {online && !isGroup ? <span className="online-dot" /> : null}
                  {isGroup ? <span className="group-badge">👥</span> : null}
                </div>
                <div className="friend-info">
                  <div className="friend-name-row">
                    <p className="friend-name">{displayName}</p>
                    {unread > 0 ? <span className="unread-badge">{unread > 99 ? "99+" : unread}</span> : null}
                  </div>
                  <span className="friend-last-msg">{item.lastMessage || "No messages yet"}</span>
                </div>
                <div className="friend-meta">
                  {!online && !isGroup ? (
                    <span className="last-seen-text">{formatLastSeen(item.userData)}</span>
                  ) : online && !isGroup ? (
                    <span className="friend-status online">Online</span>
                  ) : null}
                  <button
                    type="button"
                    className="chat-options-btn"
                    onClick={(e) => { e.stopPropagation(); setChatOptionsMenu(isMenuOpen ? null : itemMsgId); }}
                    title="Options"
                  >⋯</button>
                </div>
                {isMenuOpen ? (
                  <div className="chat-options-menu" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { setChatOptionsMenu(null); setConfirmAction({ type: isGroup ? "leaveGroup" : "remove", item }); }}>
                      {isGroup ? "Leave Group" : "Remove Chat"}
                    </button>
                    {isGroup && item.createdBy === userData?.id ? (
                      <button type="button" className="danger" onClick={() => { setChatOptionsMenu(null); setConfirmAction({ type: "deleteGroup", item }); }}>
                        Delete Group
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmAction ? (
        <div className="confirm-overlay" onClick={() => { if (!isProcessing) setConfirmAction(null); }}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">
              {confirmAction.type === "deleteGroup" ? "Delete Group" : confirmAction.type === "leaveGroup" ? "Leave Group" : "Remove Chat"}
            </p>
            <p className="confirm-text">
              {confirmAction.type === "deleteGroup"
                ? `This will permanently delete "${confirmAction.item?.groupName || "Group"}" and all messages for every member.`
                : confirmAction.type === "leaveGroup"
                  ? `Leave "${confirmAction.item?.groupName || "Group"}"? You'll be removed from the member list.`
                  : `Remove this chat from your list?`}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className={`confirm-btn ${confirmAction.type === "deleteGroup" ? "danger" : ""}`}
                disabled={isProcessing}
                onClick={async () => {
                  const action = confirmAction;
                  setIsProcessing(true);
                  try {
                    if (action.type === "deleteGroup") {
                      await deleteGroupForEveryone(action.item);
                    } else if (action.type === "leaveGroup") {
                      await leaveGroup(action.item);
                    } else {
                      await removeChatForMe(action.item);
                    }
                  } finally {
                    setIsProcessing(false);
                    setConfirmAction(null);
                  }
                }}
              >
                {isProcessing
                  ? "Processing..."
                  : confirmAction.type === "deleteGroup"
                    ? "Delete for Everyone"
                    : confirmAction.type === "leaveGroup"
                      ? "Leave"
                      : "Remove"}
              </button>
              <button type="button" className="confirm-cancel" disabled={isProcessing} onClick={() => setConfirmAction(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LeftSidebar;
