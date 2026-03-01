// Global notification manager that can be used without context
let notificationCallback = null;

export const registerNotificationCallback = (callback) => {
  notificationCallback = callback;
};

export const showNotification = (message, type = "info", duration = 4000) => {
  if (notificationCallback) {
    notificationCallback(message, type, duration);
  } else {
    // Fallback if callback not registered
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

export const notificationHelper = {
  success: (message, duration = 4000) =>
    showNotification(message, "success", duration),
  error: (message, duration = 4000) =>
    showNotification(message, "error", duration),
  info: (message, duration = 4000) =>
    showNotification(message, "info", duration),
  warning: (message, duration = 4000) =>
    showNotification(message, "warning", duration),
};
