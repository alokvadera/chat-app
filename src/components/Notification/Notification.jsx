import React from "react";
import { useNotificationContext } from "../../context/NotificationContext";
import "./Notification.css";

const Notification = () => {
  const { notifications, removeNotification } = useNotificationContext();

  return (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
        >
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === "success" && "✓"}
              {notification.type === "error" && "⚠"}
              {notification.type === "warning" && "!"}
              {notification.type === "info" && "ℹ"}
            </span>
            <span className="notification-message">{notification.message}</span>
          </div>
          <button
            className="notification-close"
            onClick={() => removeNotification(notification.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default Notification;
