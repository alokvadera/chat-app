/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useEffect, useContext as useReactContext } from "react";
import { registerNotificationCallback } from "../lib/notificationManager";

const NotificationContextInternal = createContext();

const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const notificationCounterRef = React.useRef(0);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  const addNotification = useCallback(
    (message, type = "info", duration = 4000) => {
      notificationCounterRef.current += 1;
      const id = `${Date.now()}_${notificationCounterRef.current}_${Math.random().toString(36).slice(2, 8)}`;
      const notification = { id, message, type, duration };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }

      return id;
    },
    [removeNotification]
  );

  const notify = {
    success: (message, duration = 4000) =>
      addNotification(message, "success", duration),
    error: (message, duration = 4000) =>
      addNotification(message, "error", duration),
    info: (message, duration = 4000) =>
      addNotification(message, "info", duration),
    warning: (message, duration = 4000) =>
      addNotification(message, "warning", duration),
  };

  return { notifications, addNotification, removeNotification, notify };
};

export const NotificationProvider = ({ children }) => {
  const value = useNotifications();

  // Register the callback so it can be used from anywhere
  useEffect(() => {
    registerNotificationCallback(value.addNotification);
  }, [value.addNotification]);

  return (
    <NotificationContextInternal.Provider value={value}>
      {children}
    </NotificationContextInternal.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useReactContext(NotificationContextInternal);
  if (!context) {
    throw new Error("useNotificationContext must be used within NotificationProvider");
  }
  return context;
};
