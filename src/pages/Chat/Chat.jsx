import React, { useContext, useEffect, useState } from "react";
import "./Chat.css";
import LeftSidebar from "../../components/LeftSidebar/LeftSidebar";
import ChatBox from "../../components/ChatBox/ChatBox";
import RightSidebar from "../../components/RightSidebar/RightSidebar";
import { AppContext } from "../../context/AppContextObject";
import { applyTheme, getPreferredTheme } from "../../lib/theme";

const Chat = () => {
  const { chatData, userData } = useContext(AppContext);
  const loading = !chatData || !userData;
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setTheme(getPreferredTheme());
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className="chat">
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="chat-shell">
          <div className="chat-shell-header">
            <div className="chat-shell-title">
              <span>Chat workspace</span>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                {theme === "dark" ? "☀ Light" : "🌙 Dark"}
              </span>
            </button>
          </div>
          <div className="chat-container">
            <LeftSidebar />
            <ChatBox />
            <RightSidebar />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
