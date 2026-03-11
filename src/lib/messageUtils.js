// ═══════════════════════════════════════════════════
// Message Utilities — Core messaging operations
// ═══════════════════════════════════════════════════

/**
 * Generate a unique message ID
 */
export const generateMessageId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Create a new message object with all required fields
 */
export const createMessage = ({
  sId,
  text = null,
  image = null,
  file = null,
  audio = null,
  replyTo = null,
}) => ({
  id: generateMessageId(),
  sId,
  text,
  image,
  file,
  audio,
  createdAt: new Date().toISOString(),
  status: "sent",
  reactions: {},
  replyTo,
  editedAt: null,
  deletedFor: [],
  deletedForEveryone: false,
  isPinned: false,
});

/**
 * Normalize a legacy message to include all new fields
 */
export const normalizeMessage = (msg) => {
  if (!msg) return null;
  return {
    id: msg.id || generateMessageId(),
    sId: msg.sId || "",
    text: msg.text || null,
    image: msg.image || null,
    file: msg.file || null,
    audio: msg.audio || null,
    createdAt: msg.createdAt || new Date().toISOString(),
    status: msg.status || "sent",
    reactions: msg.reactions || {},
    replyTo: msg.replyTo || null,
    editedAt: msg.editedAt || null,
    deletedFor: Array.isArray(msg.deletedFor) ? msg.deletedFor : [],
    deletedForEveryone: Boolean(msg.deletedForEveryone),
    isPinned: Boolean(msg.isPinned),
  };
};

/**
 * Filter messages that are not deleted for the current user
 */
export const filterDeletedMessages = (messages, currentUserId) =>
  messages.map((msg) => {
    const normalized = normalizeMessage(msg);
    if (normalized.deletedForEveryone) {
      return { ...normalized, text: null, image: null, file: null, audio: null, _deleted: true };
    }
    if (normalized.deletedFor.includes(currentUserId)) {
      return null;
    }
    return normalized;
  }).filter(Boolean);

/**
 * Add a reaction to a message
 */
export const addReaction = (messages, messageId, emoji, userId) =>
  messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    const reactions = { ...msg.reactions };
    const users = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    if (users.includes(userId)) {
      // Toggle off
      reactions[emoji] = users.filter((id) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, userId];
    }
    return { ...msg, reactions };
  });

/**
 * Edit a message's text
 */
export const editMessage = (messages, messageId, newText) =>
  messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    return { ...msg, text: newText, editedAt: new Date().toISOString() };
  });

/**
 * Delete a message for current user only
 */
export const deleteMessageForMe = (messages, messageId, userId) =>
  messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    const deletedFor = Array.isArray(msg.deletedFor) ? [...msg.deletedFor] : [];
    if (!deletedFor.includes(userId)) deletedFor.push(userId);
    return { ...msg, deletedFor };
  });

/**
 * Delete a message for everyone
 */
export const deleteMessageForEveryone = (messages, messageId) =>
  messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    return { ...msg, deletedForEveryone: true, text: null, image: null, file: null, audio: null };
  });

/**
 * Pin/unpin a message
 */
export const togglePinMessage = (messages, messageId) =>
  messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    return { ...msg, isPinned: !msg.isPinned };
  });

/**
 * Get pinned messages
 */
export const getPinnedMessages = (messages) =>
  messages.filter((msg) => msg.isPinned && !msg.deletedForEveryone);

/**
 * Search messages by text
 */
export const searchMessages = (messages, query, currentUserId) => {
  if (!query?.trim()) return [];
  const lower = query.trim().toLowerCase();
  return filterDeletedMessages(messages, currentUserId)
    .filter((msg) => !msg._deleted && msg.text && msg.text.toLowerCase().includes(lower));
};

/**
 * Paginate messages - get a batch of messages
 */
export const paginateMessages = (messages, page = 0, pageSize = 20) => {
  const total = messages.length;
  const start = Math.max(0, total - (page + 1) * pageSize);
  const end = Math.max(0, total - page * pageSize);
  return {
    messages: messages.slice(start, end),
    hasMore: start > 0,
    total,
  };
};

/**
 * Get the unread count for a chat item
 */
export const getUnreadCount = (chatItem) => {
  const count = Number(chatItem?.unreadCount || 0);
  return count > 0 ? count : chatItem?.messageSeen === false ? 1 : 0;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

/**
 * Get file type category from MIME type or extension
 */
export const getFileCategory = (fileNameOrType) => {
  const lower = String(fileNameOrType || "").toLowerCase();
  if (/image\/(png|jpe?g|gif|webp|svg|bmp)|\.(?:png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) return "image";
  if (/video\/(mp4|webm|mov|avi)|\.(?:mp4|webm|mov|avi)$/i.test(lower)) return "video";
  if (/audio\/(mp3|wav|ogg|webm|m4a|aac)|\.(?:mp3|wav|ogg|webm|m4a|aac)$/i.test(lower)) return "audio";
  if (/application\/pdf|\.pdf$/i.test(lower)) return "pdf";
  return "document";
};

/**
 * REACTION_EMOJIS used for quick reactions
 */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

/**
 * Message status icons
 */
export const STATUS_ICONS = {
  sent: "✓",
  delivered: "✓✓",
  seen: "✓✓",
};

/**
 * Calculate total reactions count for a message
 */
export const getTotalReactions = (reactions) => {
  if (!reactions || typeof reactions !== "object") return 0;
  return Object.values(reactions).reduce((sum, users) => sum + (Array.isArray(users) ? users.length : 0), 0);
};
