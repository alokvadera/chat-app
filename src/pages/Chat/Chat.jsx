import React, { useContext, useState, useMemo } from "react";
import "./Chat.css";
import LeftSidebar from "../../components/LeftSidebar/LeftSidebar";
import ChatBox from "../../components/ChatBox/ChatBox";
import RightSidebar from "../../components/RightSidebar/RightSidebar";
import { AppContext } from "../../context/AppContextObject";
import { applyTheme, getPreferredTheme } from "../../lib/theme";

const Chat = () => {
  const { chatData, userData } = useContext(AppContext);
  const loading = !chatData || !userData;
  
  const theme = useMemo(() => getPreferredTheme(), []);
  const [currentTheme, setCurrentTheme] = useState(theme);

  const toggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setCurrentTheme(nextTheme);
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
              aria-label={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {currentTheme === "dark" ? "☀ Light" : "🌙 Dark"}
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
