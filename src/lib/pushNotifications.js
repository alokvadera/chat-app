// ═══════════════════════════════════════════════════
// Browser push notifications utility
// ═══════════════════════════════════════════════════

const PERMISSION_KEY = "chatapp:notifications_enabled";

export const isNotificationSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  if (result === "granted") {
    localStorage.setItem(PERMISSION_KEY, "true");
  }
  return result;
};

export const isNotificationEnabled = () => {
  if (!isNotificationSupported()) return false;
  return Notification.permission === "granted" && localStorage.getItem(PERMISSION_KEY) !== "false";
};

export const setNotificationEnabled = (enabled) => {
  localStorage.setItem(PERMISSION_KEY, enabled ? "true" : "false");
};

let isPageVisible = true;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
  });
}

export const showNotification = (title, options = {}) => {
  if (!isNotificationEnabled()) return null;
  // Only show when page is not visible or user is not focused
  if (isPageVisible && document.hasFocus()) return null;

  try {
    const notification = new Notification(title, {
      icon: "/logo-icon.svg",
      badge: "/logo-icon.svg",
      tag: options.tag || "chatapp-message",
      renotify: true,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (typeof options.onClick === "function") options.onClick();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    return notification;
  } catch {
    return null;
  }
};

export const notifyNewMessage = (senderName, messageText, onClick) => {
  const body = messageText
    ? messageText.length > 60
      ? `${messageText.slice(0, 60)}...`
      : messageText
    : "Sent an attachment";

  return showNotification(senderName, {
    body,
    tag: `msg-${senderName}`,
    onClick,
  });
};
