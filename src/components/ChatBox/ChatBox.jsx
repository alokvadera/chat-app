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
import {
  createMessage,
  normalizeMessage,
  filterDeletedMessages,
  addReaction,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  togglePinMessage,
  getPinnedMessages,
  paginateMessages,
  REACTION_EMOJIS,
  STATUS_ICONS,
  getTotalReactions,
  formatFileSize,
  getFileCategory,
} from "../../lib/messageUtils";
import {
  isRecordingSupported,
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording,
} from "../../lib/voiceRecorder";
import { notifyNewMessage } from "../../lib/pushNotifications";

const EMOJI_OPTIONS = [
  "😀", "😂", "😊", "😍", "😎", "🤝",
  "👍", "👏", "🎉", "🔥", "💙", "✅",
  "🙌", "🤔", "😅", "😴",
];

const TYPING_INDICATOR_TIMEOUT_MS = 2000;
const TYPING_SIGNAL_THROTTLE_MS = 300;
const PAGE_SIZE = 20;

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
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState(null);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const roomChannelRef = useRef(null);
  const roomChannelReadyRef = useRef(false);
  const isTypingRef = useRef(false);
  const lastTypingEventRef = useRef(0);
  const messagesRef = useRef([]);
  const allMessagesRef = useRef([]);
  const shouldAutoScrollRef = useRef(true);
  const prevActiveMessageIdRef = useRef("");
  const prevMessageCountRef = useRef(0);
  const currentUserIdRef = useRef("");
  const peerTypingEnabledRef = useRef(true);
  const peerVisibleRef = useRef(true);
  const chatUserNameRef = useRef("User");
  const recordingTimerRef = useRef(null);
  const contextMenuRef = useRef(null);

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
      item?.messageId ?? item?.messagesId ?? item?.messageid ??
      item?.messagesid ?? item?.message_id ?? item?.messages_id ?? "",
    ).trim();
  const toMessagesArray = (value) => (Array.isArray(value) ? value : []);

  const isNearBottom = useCallback((threshold = 120) => {
    const container = chatMessagesRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }, []);

  const isNearTop = useCallback((threshold = 80) => {
    const container = chatMessagesRef.current;
    if (!container) return false;
    return container.scrollTop <= threshold;
  }, []);

  const normalizeMessages = useCallback((items = []) => {
    const seen = new Set();
    return [...items]
      .map(normalizeMessage)
      .filter((item) => {
        if (!item) return false;
        const sig = item.id || JSON.stringify([item.sId, item.text, item.image, item.createdAt]);
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      })
      .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  }, []);

  const areMessagesEqual = useCallback((left = [], right = []) => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      const l = left[i] || {};
      const r = right[i] || {};
      if (l.id !== r.id || l.sId !== r.sId || l.text !== r.text ||
          l.image !== r.image || l.createdAt !== r.createdAt ||
          l.editedAt !== r.editedAt || l.deletedForEveryone !== r.deletedForEveryone ||
          l.isPinned !== r.isPinned ||
          JSON.stringify(l.reactions) !== JSON.stringify(r.reactions) ||
          JSON.stringify(l.deletedFor) !== JSON.stringify(r.deletedFor)) {
        return false;
      }
    }
    return true;
  }, []);

  const updateMessagesIfChanged = useCallback((nextMessages) => {
    const normalizedNext = normalizeMessages(toMessagesArray(nextMessages));
    allMessagesRef.current = normalizedNext;
    setMessages((prev) => {
      const prevNormalized = normalizeMessages(toMessagesArray(prev));
      return areMessagesEqual(prevNormalized, normalizedNext) ? prev : normalizedNext;
    });
  }, [areMessagesEqual, normalizeMessages, setMessages]);

  const chatMessagesId = getMessageId(chatUser);
  const activeMessageId = String(messagesId || chatMessagesId || "").trim();
  const currentUserTypingEnabled = String(userData?.typing_indicators || "on") === "on";
  const currentUserVisibility = String(userData?.profile_visibility || "public");
  const shouldBroadcastTyping = currentUserTypingEnabled && currentUserVisibility !== "private";
  const peerTypingEnabled = String(chatUser?.userData?.typing_indicators || "on") === "on";
  const peerVisible = String(chatUser?.userData?.profile_visibility || "public") !== "private";
  const currentUserVisible = currentUserVisibility !== "private";
  const peerAllowsAudioCalls = chatUser?.userData?.allow_audio_calls !== false;
  const peerAllowsVideoCalls = chatUser?.userData?.allow_video_calls !== false;

  useEffect(() => { currentUserIdRef.current = String(userData?.id || "").trim(); }, [userData?.id]);

  useEffect(() => {
    peerTypingEnabledRef.current = peerTypingEnabled;
    peerVisibleRef.current = peerVisible;
    chatUserNameRef.current = String(chatUser?.userData?.name || "User").trim() || "User";
  }, [chatUser?.userData?.name, peerTypingEnabled, peerVisible]);

  // Filter messages for current user (hide deleted-for-me)
  const visibleMessages = useMemo(() => {
    if (!userData?.id) return messages;
    return filterDeletedMessages(messages, userData.id);
  }, [messages, userData?.id]);

  // Paginated messages
  const displayMessages = useMemo(() => {
    if (page === 0 && visibleMessages.length <= PAGE_SIZE) {
      setHasMoreMessages(false);
      return visibleMessages;
    }
    const totalToShow = Math.min((page + 1) * PAGE_SIZE, visibleMessages.length);
    const startIdx = Math.max(0, visibleMessages.length - totalToShow);
    setHasMoreMessages(startIdx > 0);
    return visibleMessages.slice(startIdx);
  }, [visibleMessages, page]);

  // Pinned messages
  const pinnedMessages = useMemo(() =>
    getPinnedMessages(visibleMessages),
  [visibleMessages]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return visibleMessages.filter((msg) =>
      !msg._deleted && msg.text && msg.text.toLowerCase().includes(q)
    ).slice(-20).reverse();
  }, [searchQuery, visibleMessages]);

  const typingIndicatorLabel = useMemo(() => {
    if (!typingUsers.length) return "";
    if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing...`;
    return `${typingUsers.map((i) => i.userName).join(", ")} are typing...`;
  }, [typingUsers]);

  const formatMessageDateLabel = useCallback((dateValue) => {
    const parsed = new Date(dateValue || Date.now());
    if (Number.isNaN(parsed.getTime())) return "Today";
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const dayDiff = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }, []);

  const messageItems = useMemo(() => {
    const items = [];
    let previousDateLabel = "";
    displayMessages.forEach((msg, index) => {
      const dateLabel = formatMessageDateLabel(msg?.createdAt);
      if (dateLabel !== previousDateLabel) {
        items.push({ type: "date", key: `date_${dateLabel}_${index}`, label: dateLabel });
        previousDateLabel = dateLabel;
      }
      items.push({
        type: "message",
        key: msg.id || `${msg.createdAt || msg.text || "msg"}_${index}`,
        msg,
      });
    });
    return items;
  }, [formatMessageDateLabel, displayMessages]);

  const getOrCreateMessageRow = useCallback(async () => {
    if (!activeMessageId) return null;
    const { data, error } = await supabase
      .from("messages").select("id,messages").eq("id", activeMessageId).limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (row) return row;
    const { data: inserted, error: insertError } = await supabase
      .from("messages").insert({ id: activeMessageId, messages: [] }).select("id,messages").limit(1);
    if (insertError) throw insertError;
    return inserted?.[0] || { id: activeMessageId, messages: [] };
  }, [activeMessageId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (emojiPickerRef.current?.contains(e.target) || emojiButtonRef.current?.contains(e.target)) return;
      setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  useEffect(() => { messagesRef.current = normalizeMessages(messages); }, [messages, normalizeMessages]);

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
    setPage(0);
    setShowSearch(false);
    setSearchQuery("");
    setReplyingTo(null);
    setEditingMessage(null);
    setContextMenu(null);
    setShowPinned(false);
    setShowReactionPicker(null);
  }, [activeMessageId]);

  // ─── Typing signals ────────────────────────────────────────────────────
  const sendTypingSignal = useCallback(async (isTypingNow) => {
    if (isDesignPreviewMode) return;
    if (!activeMessageId || !userData?.id || !chatUser?.rId) return;
    if (!shouldBroadcastTyping) return;
    const channel = roomChannelRef.current;
    if (!channel || !roomChannelReadyRef.current) return;
    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        roomId: activeMessageId,
        userId: userData.id,
        userName: userData?.name || userData?.username || "User",
        isTyping: isTypingNow,
      },
    });
  }, [activeMessageId, chatUser?.rId, shouldBroadcastTyping, userData?.id, userData?.name, userData?.username]);

  useEffect(() => () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      void sendTypingSignal(false);
    }
    lastTypingEventRef.current = 0;
    typingTimersRef.current.forEach((id) => clearTimeout(id));
    typingTimersRef.current.clear();
  }, [sendTypingSignal]);

  const handleTypingSignal = useCallback((nextIsTyping) => {
    if (!shouldBroadcastTyping) return;
    if (!nextIsTyping) {
      lastTypingEventRef.current = 0;
      void sendTypingSignal(false);
      return;
    }
    const now = Date.now();
    if (!lastTypingEventRef.current || now - lastTypingEventRef.current >= TYPING_SIGNAL_THROTTLE_MS) {
      lastTypingEventRef.current = now;
      void sendTypingSignal(true);
    }
  }, [sendTypingSignal, shouldBroadcastTyping]);

  const clearTypingUser = useCallback((userId) => {
    const uid = String(userId || "").trim();
    if (!uid) return;
    const existing = typingTimersRef.current.get(uid);
    if (existing) { clearTimeout(existing); typingTimersRef.current.delete(uid); }
    setTypingUsers((prev) => prev.filter((i) => i.userId !== uid));
  }, []);

  const applyTypingState = useCallback((payload) => {
    if (!payload) return;
    const eventRoomId = String(payload.roomId || "").trim();
    const eventUserId = String(payload.userId || "").trim();
    if (!eventRoomId || eventRoomId !== activeMessageId) return;
    if (!eventUserId || eventUserId === currentUserIdRef.current) return;
    if (!peerTypingEnabledRef.current || !peerVisibleRef.current) return;

    const existing = typingTimersRef.current.get(eventUserId);
    if (existing) { clearTimeout(existing); typingTimersRef.current.delete(eventUserId); }

    if (!payload.isTyping) { clearTypingUser(eventUserId); return; }

    const nextUserName = String(payload.userName || chatUserNameRef.current || "User").trim();
    setTypingUsers((prev) => {
      const next = prev.filter((i) => i.userId !== eventUserId);
      next.push({ userId: eventUserId, userName: nextUserName });
      return next;
    });
    const timeoutId = setTimeout(() => clearTypingUser(eventUserId), TYPING_INDICATOR_TIMEOUT_MS);
    typingTimersRef.current.set(eventUserId, timeoutId);
  }, [activeMessageId, clearTypingUser]);

  const onSelectEmoji = (emoji) => {
    setInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // ─── Helper: persist messages to Supabase ────────────────────────────
  const persistMessages = useCallback(async (updatedMessages) => {
    const { error } = await supabase
      .from("messages")
      .update({ messages: updatedMessages })
      .eq("id", activeMessageId);
    if (error) throw error;
  }, [activeMessageId]);

  // ─── Helper: update users' chats_data ────────────────────────────────
  const updateChatsData = async (lastMessage) => {
    const peerId = String(chatUser?.rId ?? chatUser?.rid ?? "").trim();
    const senderId = String(userData?.id || "").trim();
    if (!senderId || !activeMessageId) return;

    const isGroup = Boolean(chatUser?.isGroup);
    let userTargets;

    if (isGroup) {
      // For groups, update all members' chats_data
      const members = Array.isArray(chatUser?.groupMembers) ? chatUser.groupMembers : [];
      userTargets = members.map((memberId) => ({
        id: memberId,
        messageSeen: memberId === senderId,
        incrementUnread: memberId !== senderId,
      }));
    } else {
      if (!peerId) return;
      userTargets = [
        { id: senderId, messageSeen: true, incrementUnread: false },
        { id: peerId, messageSeen: false, incrementUnread: true },
      ];
    }

    for (const target of userTargets) {
      try {
        const { data, error } = await supabase
          .from("chats").select("chats_data").eq("id", target.id).limit(1);
        if (error) throw error;

        const chatRow = data?.[0];
        const chatsData = [...toMessagesArray(chatRow?.chats_data)];
        const chatIndex = chatsData.findIndex((c) => {
          const rowMsgId = getMessageId(c);
          return rowMsgId === activeMessageId;
        });

        const existing = chatIndex >= 0 ? chatsData[chatIndex] : {};
        const currentUnread = Number(existing.unreadCount || 0);
        const updatedEntry = {
          ...existing,
          messageId: activeMessageId,
          rId: isGroup ? activeMessageId : (target.id === senderId ? peerId : senderId),
          lastMessage,
          updatedAt: Date.now(),
          messageSeen: target.messageSeen,
          unreadCount: target.incrementUnread ? currentUnread + 1 : 0,
          ...(isGroup ? {
            isGroup: true,
            groupName: chatUser?.groupName || "",
            groupMembers: chatUser?.groupMembers || [],
          } : {}),
        };

        if (chatIndex !== -1) {
          chatsData[chatIndex] = updatedEntry;
        } else {
          chatsData.push(updatedEntry);
        }

        if (!chatRow) {
          const { error: insertError } = await supabase
            .from("chats").insert({ id: target.id, chats_data: chatsData });
          if (insertError) throw insertError;
          continue;
        }
        const { error: updateError } = await supabase
          .from("chats").update({ chats_data: chatsData }).eq("id", target.id);
        if (updateError) throw updateError;
      } catch (err) {
        // Don't fail the whole send if one member's chats_data update fails
        console.warn("updateChatsData target error:", target.id, err?.message);
      }
    }
  };

  // ─── Send text message ────────────────────────────────────────────────────
  const sendMessage = async () => {
    try {
      const messageText = input.trim();
      if (!messageText || !activeMessageId || !userData?.id) return;

      const targetUserId = chatUser?.rId || chatUser?.userData?.id;
      if (targetUserId && !isDesignPreviewMode) {
        const { data: blockData } = await supabase
          .from("blocked_users")
          .select("id")
          .eq("blocked_by", targetUserId)
          .eq("blocked_user", userData.id)
          .maybeSingle();
        if (blockData) {
          notificationHelper.error("You cannot send messages to this user");
          return;
        }
      }

      if (isTypingRef.current) {
        isTypingRef.current = false;
        void sendTypingSignal(false);
      }

      // Handle edit mode
      if (editingMessage) {
        const updated = editMessage(allMessagesRef.current, editingMessage.id, messageText);
        shouldAutoScrollRef.current = false;
        updateMessagesIfChanged(updated);
        setInput("");
        setEditingMessage(null);
        if (!isDesignPreviewMode) {
          const currentRow = await getOrCreateMessageRow();
          const merged = normalizeMessages([...toMessagesArray(currentRow?.messages)]);
          const finalMessages = editMessage(merged, editingMessage.id, messageText);
          await persistMessages(finalMessages);
        }
        return;
      }

      const newMsg = createMessage({
        sId: userData.id,
        text: messageText,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          sId: replyingTo.sId,
          image: replyingTo.image,
        } : null,
      });

      if (isDesignPreviewMode) {
        shouldAutoScrollRef.current = true;
        setMessages((prev) => [...toMessagesArray(prev), newMsg]);
        setInput("");
        setShowEmojiPicker(false);
        setReplyingTo(null);
        return;
      }

      // Optimistic update
      const optimisticMessages = normalizeMessages([...toMessagesArray(messagesRef.current), newMsg]);
      shouldAutoScrollRef.current = true;
      updateMessagesIfChanged(optimisticMessages);
      setInput("");
      setShowEmojiPicker(false);
      setReplyingTo(null);

      const currentRow = await getOrCreateMessageRow();
      const updatedMessages = normalizeMessages([...toMessagesArray(currentRow?.messages), newMsg]);

      // Mark as delivered
      const withDelivered = updatedMessages.map((m) =>
        m.id === newMsg.id ? { ...m, status: "delivered" } : m
      );
      await persistMessages(withDelivered);
      await updateChatsData(messageText.slice(0, 30));
    } catch (error) {
      updateMessagesIfChanged(messagesRef.current);
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Send file (image, video, document, PDF) ──────────────────────────
  const sendFile = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const category = getFileCategory(file.type || file.name);
      const isImage = category === "image";
      const localUrl = URL.createObjectURL(file);

      const newMsg = createMessage({
        sId: userData.id,
        image: isImage ? localUrl : null,
        file: !isImage ? { url: localUrl, name: file.name, type: file.type, size: file.size } : null,
        replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, sId: replyingTo.sId } : null,
      });

      if (isDesignPreviewMode) {
        shouldAutoScrollRef.current = true;
        setMessages((prev) => [...toMessagesArray(prev), newMsg]);
        setReplyingTo(null);
        return;
      }

      const optimisticMessages = normalizeMessages([...toMessagesArray(messagesRef.current), newMsg]);
      shouldAutoScrollRef.current = true;
      updateMessagesIfChanged(optimisticMessages);
      setReplyingTo(null);

      const fileUrl = await upload(file);
      if (!fileUrl || !activeMessageId) return;

      const persistedMsg = {
        ...newMsg,
        image: isImage ? fileUrl : null,
        file: !isImage ? { url: fileUrl, name: file.name, type: file.type, size: file.size } : null,
        status: "delivered",
      };

      const currentRow = await getOrCreateMessageRow();
      const updatedMessages = normalizeMessages([
        ...toMessagesArray(currentRow?.messages).filter((m) => m.id !== newMsg.id),
        persistedMsg,
      ]);

      await persistMessages(updatedMessages);
      await updateChatsData(isImage ? "📷 Image" : `📎 ${file.name}`);
    } catch (error) {
      updateMessagesIfChanged(messagesRef.current);
      notificationHelper.error(toUserErrorMessage(error));
    } finally {
      e.target.value = "";
    }
  };

  // ─── Send voice message ──────────────────────────────────────────────
  const handleVoiceRecord = async () => {
    if (recording) {
      try {
        const result = await stopRecording();
        setRecording(false);
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);

        if (!result?.blob) return;

        const audioFile = new File([result.blob], `voice_${Date.now()}.webm`, { type: result.mimeType });
        const localUrl = result.url;

        const newMsg = createMessage({ sId: userData.id, audio: localUrl });

        if (isDesignPreviewMode) {
          shouldAutoScrollRef.current = true;
          setMessages((prev) => [...toMessagesArray(prev), newMsg]);
          return;
        }

        const optimisticMessages = normalizeMessages([...toMessagesArray(messagesRef.current), newMsg]);
        shouldAutoScrollRef.current = true;
        updateMessagesIfChanged(optimisticMessages);

        const fileUrl = await upload(audioFile);
        if (!fileUrl) return;

        const persistedMsg = { ...newMsg, audio: fileUrl, status: "delivered" };
        const currentRow = await getOrCreateMessageRow();
        const updatedMessages = normalizeMessages([
          ...toMessagesArray(currentRow?.messages).filter((m) => m.id !== newMsg.id),
          persistedMsg,
        ]);
        await persistMessages(updatedMessages);
        await updateChatsData("🎤 Voice message");
      } catch (error) {
        setRecording(false);
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        notificationHelper.error("Failed to send voice message.");
      }
    } else {
      try {
        await startRecording();
        setRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      } catch (error) {
        notificationHelper.error(error.message || "Cannot access microphone.");
      }
    }
  };

  const cancelVoiceRecording = () => {
    cancelRecording();
    setRecording(false);
    clearInterval(recordingTimerRef.current);
    setRecordingTime(0);
  };

  // ─── Reactions ────────────────────────────────────────────────────────
  const handleReaction = async (messageId, emoji) => {
    try {
      setShowReactionPicker(null);
      const updated = addReaction(allMessagesRef.current, messageId, emoji, userData.id);
      updateMessagesIfChanged(updated);

      if (!isDesignPreviewMode) {
        const currentRow = await getOrCreateMessageRow();
        const merged = normalizeMessages(toMessagesArray(currentRow?.messages));
        const final = addReaction(merged, messageId, emoji, userData.id);
        await persistMessages(final);
      }
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Delete message ──────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId, forEveryone = false) => {
    try {
      setContextMenu(null);
      const updated = forEveryone
        ? deleteMessageForEveryone(allMessagesRef.current, messageId)
        : deleteMessageForMe(allMessagesRef.current, messageId, userData.id);
      updateMessagesIfChanged(updated);

      if (!isDesignPreviewMode) {
        const currentRow = await getOrCreateMessageRow();
        const merged = normalizeMessages(toMessagesArray(currentRow?.messages));
        const final = forEveryone
          ? deleteMessageForEveryone(merged, messageId)
          : deleteMessageForMe(merged, messageId, userData.id);
        await persistMessages(final);
      }
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Pin / Unpin ─────────────────────────────────────────────────────
  const handleTogglePin = async (messageId) => {
    try {
      setContextMenu(null);
      const updated = togglePinMessage(allMessagesRef.current, messageId);
      updateMessagesIfChanged(updated);

      if (!isDesignPreviewMode) {
        const currentRow = await getOrCreateMessageRow();
        const merged = normalizeMessages(toMessagesArray(currentRow?.messages));
        const final = togglePinMessage(merged, messageId);
        await persistMessages(final);
      }
    } catch (error) {
      notificationHelper.error(toUserErrorMessage(error));
    }
  };

  // ─── Mark messages as seen ────────────────────────────────────────────
  const markMessagesAsSeen = useCallback(async () => {
    if (isDesignPreviewMode || !activeMessageId || !userData?.id) return;
    try {
      const currentRow = await getOrCreateMessageRow();
      const msgs = normalizeMessages(toMessagesArray(currentRow?.messages));
      let changed = false;
      const updated = msgs.map((m) => {
        if (m.sId !== userData.id && m.status !== "seen") {
          changed = true;
          return { ...m, status: "seen" };
        }
        return m;
      });
      if (changed) {
        await persistMessages(updated);
        updateMessagesIfChanged(updated);
      }
    } catch { /* ignore */ }
  }, [activeMessageId, getOrCreateMessageRow, normalizeMessages, persistMessages, updateMessagesIfChanged, userData?.id]);

  // Mark as seen when chat is opened or focused
  useEffect(() => {
    if (!activeMessageId || !userData?.id) return;
    markMessagesAsSeen();
  }, [activeMessageId, messages.length, markMessagesAsSeen, userData?.id]);

  // Mark as read after viewing for 3 seconds
  useEffect(() => {
    if (isDesignPreviewMode || !activeMessageId || !userData?.id || !chatVisible) return;

    const timer = setTimeout(async () => {
      try {
        const currentRow = await getOrCreateMessageRow();
        const msgs = normalizeMessages(toMessagesArray(currentRow?.messages));
        let changed = false;
        const updated = msgs.map((m) => {
          if (m.sId !== userData.id && (m.status === "seen" || m.status === "delivered")) {
            changed = true;
            return { ...m, status: "read", readAt: Date.now() };
          }
          return m;
        });
        if (changed) {
          await persistMessages(updated);
          updateMessagesIfChanged(updated);
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => clearTimeout(timer);
  }, [activeMessageId, chatVisible, getOrCreateMessageRow, normalizeMessages, persistMessages, updateMessagesIfChanged, userData?.id]);

  // ─── Load more (pagination) ──────────────────────────────────────────
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    setPage((p) => p + 1);
    setTimeout(() => setLoadingMore(false), 200);
  }, [hasMoreMessages, loadingMore]);

  // ─── Format timestamp ─────────────────────────────────────────────────────
  const convertTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, "0");
    return hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:${minute} PM` : `${hour}:${minute} AM`;
  };

  const formatRecordingTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ─── Context menu handler ─────────────────────────────────────────────
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const rect = chatMessagesRef.current?.getBoundingClientRect();
    setContextMenu({
      msg,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    });
  };

  // ─── Realtime messages subscription ──────────────────────────────────────
  useEffect(() => {
    if (isDesignPreviewMode) return;
    if (!activeMessageId) {
      setMessages([]);
      setTypingUsers([]);
      roomChannelRef.current = null;
      roomChannelReadyRef.current = false;
      prevActiveMessageIdRef.current = "";
      prevMessageCountRef.current = 0;
      return;
    }

    let isActive = true;

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

    const channel = supabase
      .channel(`room-${activeMessageId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `id=eq.${activeMessageId}`,
      }, (payload) => {
        if (!isActive) return;
        const nextMessages = payload?.new?.messages;
        if (Array.isArray(nextMessages)) {
          const normalized = normalizeMessages(nextMessages);
          const latest = normalized[normalized.length - 1];

          if (latest?.sId && String(latest.sId) !== currentUserIdRef.current) {
            clearTypingUser(latest.sId);

            // Push notification for incoming message
            const senderName = chatUserNameRef.current || "Someone";
            notifyNewMessage(senderName, latest.text || (latest.image ? "Sent an image" : "Sent a message"));
          }

          updateMessagesIfChanged(normalized);
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!isActive) return;
        applyTypingState(payload);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        if (!isActive || !payload) return;
        // Realtime reaction sync already handled via postgres_changes
      })
      .subscribe((status) => {
        roomChannelReadyRef.current = status === "SUBSCRIBED";
      });

    roomChannelRef.current = channel;

    return () => {
      isActive = false;
      roomChannelReadyRef.current = false;
      roomChannelRef.current = null;
      typingTimersRef.current.forEach((id) => clearTimeout(id));
      typingTimersRef.current.clear();
      setTypingUsers([]);
      supabase.removeChannel(channel);
    };
  }, [activeMessageId, applyTypingState, clearTypingUser, getOrCreateMessageRow, normalizeMessages, setMessages, updateMessagesIfChanged]);

  const isOnline = isUserOnline(chatUser?.userData);

  const toggleMyVisibility = async () => {
    const next = currentUserVisible ? "private" : "public";
    const result = await updateCurrentUserPreferences({ profile_visibility: next });
    if (!result?.ok) { notificationHelper.error("Unable to update visibility."); return; }
    notificationHelper.success(next === "private" ? "You are now hidden." : "You are now visible.");
  };

  // ─── Start reply ──────────────────────────────────────────────────────
  const startReply = (msg) => {
    setReplyingTo(msg);
    setEditingMessage(null);
    setContextMenu(null);
    messageInputRef.current?.focus();
  };

  // ─── Start edit ───────────────────────────────────────────────────────
  const startEdit = (msg) => {
    setEditingMessage(msg);
    setInput(msg.text || "");
    setReplyingTo(null);
    setContextMenu(null);
    messageInputRef.current?.focus();
  };

  // ─── Render message content ───────────────────────────────────────────
  const renderMessageContent = (msg, isSent) => {
    // Deleted message
    if (msg._deleted || msg.deletedForEveryone) {
      return (
        <div className="msg msg-deleted">
          <p className="msg-text deleted-text">🚫 This message was deleted</p>
        </div>
      );
    }

    return (
      <>
        {/* Reply preview */}
        {msg.replyTo ? (
          <div className="reply-preview">
            <span className="reply-author">
              {msg.replyTo.sId === userData?.id ? "You" : chatUser?.userData?.name}
            </span>
            <p className="reply-text">
              {msg.replyTo.image ? "📷 Image" : (msg.replyTo.text || "").slice(0, 60)}
            </p>
          </div>
        ) : null}

        {/* Image message */}
        {msg.image ? (
          <img
            className="msg-img"
            src={msg.image}
            alt=""
            onLoad={() => { if (shouldAutoScrollRef.current) scrollToBottom(); }}
            onClick={() => window.open(msg.image, "_blank")}
          />
        ) : null}

        {/* File attachment */}
        {msg.file ? (
          <div className="msg-file">
            <div className="file-icon">
              {getFileCategory(msg.file.type || msg.file.name) === "pdf" ? "📄" :
               getFileCategory(msg.file.type || msg.file.name) === "video" ? "🎬" : "📎"}
            </div>
            <div className="file-info">
              <a href={msg.file.url} target="_blank" rel="noopener noreferrer" className="file-name">
                {msg.file.name || "File"}
              </a>
              <span className="file-size">{formatFileSize(msg.file.size)}</span>
            </div>
          </div>
        ) : null}

        {/* Voice message */}
        {msg.audio ? (
          <div className="msg-audio">
            <audio controls preload="metadata" src={msg.audio}>
              <track kind="captions" />
            </audio>
          </div>
        ) : null}

        {/* Text message */}
        {msg.text && !msg.image ? (
          <div className="msg">
            <p className="msg-text">{msg.text}</p>
            {msg.editedAt ? <span className="msg-edited">(edited)</span> : null}
          </div>
        ) : null}
      </>
    );
  };

  // ─── Render reactions ─────────────────────────────────────────────────
  const renderReactions = (msg) => {
    const reactions = msg.reactions;
    if (!reactions || getTotalReactions(reactions) === 0) return null;
    return (
      <div className="msg-reactions">
        {Object.entries(reactions).map(([emoji, users]) => {
          if (!Array.isArray(users) || !users.length) return null;
          const isActive = users.includes(userData?.id);
          return (
            <button
              key={emoji}
              type="button"
              className={`reaction-badge ${isActive ? "active" : ""}`}
              onClick={() => handleReaction(msg.id, emoji)}
              title={users.length === 1 ? "1 reaction" : `${users.length} reactions`}
            >
              {emoji} {users.length}
            </button>
          );
        })}
      </div>
    );
  };

  return chatUser ? (
    <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
      {/* ── Header ── */}
      <div className="chat-user">
        <img src={chatUserAvatar} alt="" />
        <div className="chat-user-meta">
          <p>
            {chatUser.isGroup ? (chatUser.groupName || "Group") : (chatUser.userData?.name || "User")}
          </p>
          {chatUser.isGroup ? (
            <span className="group-member-count">
              {Array.isArray(chatUser.groupMembers) ? chatUser.groupMembers.length : 0} members
            </span>
          ) : (
            <span className={`presence ${isOnline ? "online" : "away"}`}>
              {typingUsers.length ? typingIndicatorLabel : isOnline ? "Online" : "Offline"}
            </span>
          )}
        </div>
        <div className="chat-user-actions">
          <button type="button" className="icon-btn" title="Search" onClick={() => setShowSearch((p) => !p)}>🔍</button>
          <button type="button" className="icon-btn" title="Pinned" onClick={() => setShowPinned((p) => !p)}>
            📌 {pinnedMessages.length > 0 ? <span className="pin-count">{pinnedMessages.length}</span> : null}
          </button>
          <button type="button" className="icon-btn call-btn" title="Audio Call" disabled={!isOnline || !peerAllowsAudioCalls}
            onClick={() => {
              const targetId = chatUser?.userData?.id || chatUser?.rId;
              if (!targetId) { notificationHelper.error("Select a valid chat user."); return; }
              if (!peerAllowsAudioCalls) { notificationHelper.error("User has disabled audio calls."); return; }
              if (!isOnline) { notificationHelper.error("User is offline."); return; }
              void initiateCall(targetId, false, "audio");
            }}>📞</button>
          <button type="button" className="icon-btn video-btn" title="Video Call" disabled={!isOnline || !peerAllowsVideoCalls}
            onClick={() => {
              const targetId = chatUser?.userData?.id || chatUser?.rId;
              if (!targetId) { notificationHelper.error("Select a valid chat user."); return; }
              if (!peerAllowsVideoCalls) { notificationHelper.error("User has disabled video calls."); return; }
              if (!isOnline) { notificationHelper.error("User is offline."); return; }
              void initiateCall(targetId, false);
            }}>🎥</button>
          <button type="button" className="icon-btn info-btn" title="Info" onClick={() => setChatInfoPanelOpen((p) => !p)}>ℹ️</button>
          <button type="button" className="icon-btn info-btn" title={currentUserVisible ? "Go invisible" : "Go visible"}
            onClick={toggleMyVisibility}>{currentUserVisible ? "👁️" : "🙈"}</button>
        </div>
        <img onClick={() => setChatVisible(false)} src={assets.arrow_icon} className="arrow" alt="" />
      </div>

      {/* ── Search bar ── */}
      {showSearch ? (
        <div className="chat-search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <span className="search-count">{searchResults.length} results</span>
          <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>✕</button>
        </div>
      ) : null}

      {/* ── Search results ── */}
      {showSearch && searchResults.length > 0 ? (
        <div className="chat-search-results">
          {searchResults.map((msg) => (
            <div key={msg.id} className="search-result-item">
              <span className="search-result-sender">
                {msg.sId === userData?.id ? "You" : chatUser?.userData?.name}
              </span>
              <p>{msg.text}</p>
              <span className="search-result-time">{convertTimestamp(msg.createdAt)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Pinned messages ── */}
      {showPinned && pinnedMessages.length > 0 ? (
        <div className="pinned-messages-bar">
          <div className="pinned-header">
            <span>📌 Pinned Messages ({pinnedMessages.length})</span>
            <button type="button" onClick={() => setShowPinned(false)}>✕</button>
          </div>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="pinned-item">
              <p>{msg.text || (msg.image ? "📷 Image" : "📎 File")}</p>
              <span>{convertTimestamp(msg.createdAt)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Messages area ── */}
      <div
        className="chat-msg"
        ref={chatMessagesRef}
        onScroll={() => {
          shouldAutoScrollRef.current = isNearBottom();
          if (isNearTop() && hasMoreMessages) loadMoreMessages();
        }}
      >
        {loadingMore ? <div className="loading-more">Loading older messages...</div> : null}
        {hasMoreMessages && !loadingMore ? (
          <button type="button" className="load-more-btn" onClick={loadMoreMessages}>
            Load older messages
          </button>
        ) : null}

        {messageItems.map((item) => {
          if (item.type === "date") {
            return (
              <div key={item.key} className="chat-date-separator">
                <span>{item.label}</span>
              </div>
            );
          }

          const msg = item.msg;
          const isSent = msg.sId === userData.id;
          const messageAvatar = isSent ? currentUserAvatar : chatUserAvatar;

          return (
            <div
              key={item.key}
              className={`message-row ${isSent ? "s-msg" : "r-msg"} ${msg.isPinned ? "pinned" : ""}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              {!isSent ? <img className="message-avatar" src={messageAvatar} alt="" /> : null}
              <div className="message-stack">
                {renderMessageContent(msg, isSent)}
                {renderReactions(msg)}
                <div className="message-meta">
                  <p className="message-time">{convertTimestamp(msg.createdAt)}</p>
                  {isSent && msg.status ? (
                    <span className={`msg-status ${msg.status}`} title={msg.status}>
                      {STATUS_ICONS[msg.status]}
                    </span>
                  ) : null}
                  {msg.isPinned ? <span className="pinned-badge">📌</span> : null}
                </div>

                {/* Quick reaction button */}
                {!msg._deleted && !msg.deletedForEveryone ? (
                  <div className="msg-hover-actions">
                    <button type="button" className="hover-action-btn" title="React"
                      onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}>😊</button>
                    <button type="button" className="hover-action-btn" title="Reply"
                      onClick={() => startReply(msg)}>↩️</button>
                    {isSent && msg.text ? (
                      <button type="button" className="hover-action-btn" title="Edit"
                        onClick={() => startEdit(msg)}>✏️</button>
                    ) : null}
                    <button type="button" className="hover-action-btn" title="More"
                      onClick={(e) => handleContextMenu(e, msg)}>⋯</button>
                  </div>
                ) : null}

                {/* Reaction picker */}
                {showReactionPicker === msg.id ? (
                  <div className="reaction-picker">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" className="reaction-pick-btn"
                        onClick={() => handleReaction(msg.id, emoji)}>{emoji}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Context menu */}
        {contextMenu ? (
          <div
            className="context-menu"
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button type="button" onClick={() => startReply(contextMenu.msg)}>↩️ Reply</button>
            {contextMenu.msg.sId === userData.id && contextMenu.msg.text ? (
              <button type="button" onClick={() => startEdit(contextMenu.msg)}>✏️ Edit</button>
            ) : null}
            <button type="button" onClick={() => handleTogglePin(contextMenu.msg.id)}>
              {contextMenu.msg.isPinned ? "📌 Unpin" : "📌 Pin"}
            </button>
            <button type="button" onClick={() => handleDeleteMessage(contextMenu.msg.id, false)}>
              🗑️ Delete for me
            </button>
            {contextMenu.msg.sId === userData.id ? (
              <button type="button" onClick={() => handleDeleteMessage(contextMenu.msg.id, true)}>
                🗑️ Delete for everyone
              </button>
            ) : null}
            <button type="button" onClick={() => setContextMenu(null)}>✕ Cancel</button>
          </div>
        ) : null}

        {/* Typing indicator */}
        {typingUsers.length ? (
          <div className="typing-indicator-row">
            <img className="message-avatar" src={chatUserAvatar} alt="" />
            <div className="message-stack typing-stack">
              <div className="typing-indicator">
                <span className="typing-label">{typingIndicatorLabel.replace(/\.\.\.$/, "").trim()}</span>
                <span className="typing-dots" aria-hidden="true">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Reply / Edit bar ── */}
      {replyingTo ? (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <span className="reply-bar-label">Replying to {replyingTo.sId === userData?.id ? "yourself" : chatUser?.userData?.name}</span>
            <p className="reply-bar-text">{replyingTo.image ? "📷 Image" : (replyingTo.text || "").slice(0, 60)}</p>
          </div>
          <button type="button" className="reply-bar-close" onClick={() => setReplyingTo(null)}>✕</button>
        </div>
      ) : null}

      {editingMessage ? (
        <div className="reply-bar edit-bar">
          <div className="reply-bar-content">
            <span className="reply-bar-label">✏️ Editing message</span>
            <p className="reply-bar-text">{(editingMessage.text || "").slice(0, 60)}</p>
          </div>
          <button type="button" className="reply-bar-close" onClick={() => { setEditingMessage(null); setInput(""); }}>✕</button>
        </div>
      ) : null}

      {/* ── Input bar ── */}
      <div className="chat-input">
        {!currentUserTypingEnabled ? (
          <span className="typing-disabled-hint">Typing indicators are off</span>
        ) : null}

        {recording ? (
          <>
          <div className="chat-composer recording-composer">
            <span className="recording-indicator">🔴 Recording {formatRecordingTime(recordingTime)}</span>
            <button type="button" className="input-icon cancel-record" onClick={cancelVoiceRecording} title="Cancel">✕</button>
          </div>
          <button type="button" className="send-btn" onClick={handleVoiceRecord} title="Send voice message">
            <svg className="send-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
          </>
        ) : (
          <>
          <div className="chat-composer">
            <button type="button" className="input-icon" onClick={() => fileInputRef.current?.click()} title="Attach file">+</button>
            <input
              ref={messageInputRef}
              onChange={(e) => {
                const nextValue = e.target.value;
                setInput(nextValue);
                if (!shouldBroadcastTyping) return;
                const nextIsTyping = nextValue.trim().length > 0;
                if (nextIsTyping) { isTypingRef.current = true; handleTypingSignal(true); }
                else if (isTypingRef.current) { isTypingRef.current = false; handleTypingSignal(false); }
              }}
              value={input}
              type="text"
              placeholder={editingMessage ? "Edit message..." : "Write a message"}
              onBlur={() => { if (isTypingRef.current) { isTypingRef.current = false; handleTypingSignal(false); } }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
                if (e.key === "Escape") { setReplyingTo(null); setEditingMessage(null); setInput(""); }
              }}
            />
            <input ref={fileInputRef} onChange={sendFile} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" hidden />
            <input ref={imageInputRef} onChange={sendFile} type="file" accept="image/png, image/jpeg" hidden />
            <label htmlFor="image" className="input-icon" title="Gallery" onClick={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}>
              <img src={assets.gallery_icon} alt="" />
            </label>
            {isRecordingSupported() ? (
              <button type="button" className="input-icon" onClick={handleVoiceRecord} title="Voice message">🎤</button>
            ) : null}
            <button ref={emojiButtonRef} type="button" className="input-icon"
              onClick={() => setShowEmojiPicker((p) => !p)} title="Emoji">😊</button>
          </div>
          <button type="button" className="send-btn" onClick={sendMessage} title="Send message" aria-label="Send message">
            <svg className="send-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
          </>
        )}

        {showEmojiPicker ? (
          <div className="emoji-picker" ref={emojiPickerRef}>
            {EMOJI_OPTIONS.map((emoji) => (
              <button key={emoji} type="button" className="emoji-item" onClick={() => onSelectEmoji(emoji)}>{emoji}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
      <img src="/logo-icon.svg" alt="" />
      <p>Chat anytime, anywhere</p>
      <span className="welcome-subtitle">Select a conversation to start messaging</span>
    </div>
  );
};

export default ChatBox;
