import React, { useContext, useMemo, useState } from "react";
import "./RightSidebar.css";
import assets from "../../assets/assets";
import { isDesignPreviewMode, supabase } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { useNavigate } from "react-router-dom";

const RightSidebar = () => {
  const navigate = useNavigate();
  const {
    chatUser,
    messages,
    clearAppState,
    isUserOnline,
    chatInfoPanelOpen,
    setChatInfoPanelOpen,
    userData,
  } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState("");
  const chatUserAvatar = chatUser?.userData?.avatar || assets.avatar_icon;

  const msgImages = useMemo(
    () => messages.filter((msg) => msg.image).map((msg) => msg.image),
    [messages],
  );

  const textMessages = useMemo(
    () => messages.filter((msg) => typeof msg?.text === "string" && msg.text.trim()),
    [messages],
  );

  const searchedMessages = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    return textMessages
      .filter((msg) => String(msg.text || "").toLowerCase().includes(query))
      .slice(-15)
      .reverse();
  }, [searchTerm, textMessages]);

  const firstMessageDate = useMemo(() => {
    const first = messages.find((msg) => msg?.createdAt);
    if (!first?.createdAt) return "-";
    const parsed = new Date(first.createdAt);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [messages]);

  const linkCount = useMemo(
    () => textMessages.reduce((count, msg) => count + (/https?:\/\//i.test(msg.text || "") ? 1 : 0), 0),
    [textMessages],
  );

  const isOnline = isUserOnline(chatUser?.userData);

  const formatTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const hour = parsed.getHours();
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return hour >= 12
      ? `${hour === 12 ? 12 : hour - 12}:${minute} PM`
      : `${hour}:${minute} AM`;
  };

  const handleLogout = async () => {
    if (isDesignPreviewMode) {
      clearAppState();
      navigate("/");
      return;
    }
    await supabase.auth.signOut();
  };

  return chatUser ? (
    <div className="rs">
      <div className="rs-profile">
        <img src={chatUserAvatar} alt="" />
        <h3>{chatUser.userData.name}</h3>
        <span className={`rs-status ${isOnline ? "online" : "away"}`}>
          {isOnline ? "Online" : "Offline"}
        </span>
        <p>{chatUser.userData.bio}</p>
      </div>
      <hr />
      {chatInfoPanelOpen ? (
        <div className="rs-info-panel">
          <div className="rs-info-head">
            <p>Chat Info</p>
            <button
              type="button"
              className="rs-close-btn"
              onClick={() => setChatInfoPanelOpen(false)}
              aria-label="Close chat info"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="rs-stats-grid">
            <div className="rs-stat-card">
              <span>Messages</span>
              <strong>{messages.length}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Media</span>
              <strong>{msgImages.length}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Links</span>
              <strong>{linkCount}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Since</span>
              <strong>{firstMessageDate}</strong>
            </div>
          </div>

          <div className="rs-search-section">
            <p>Search in chat</p>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Find message text"
            />
            <div className="rs-search-results">
              {!searchTerm.trim() ? (
                <span className="rs-empty-state">Type to search messages</span>
              ) : searchedMessages.length ? (
                searchedMessages.map((msg, index) => (
                  <div key={`${msg.createdAt || "res"}_${index}`} className="rs-search-item">
                    <p>{msg.text}</p>
                    <span>
                      {String(msg.sId || "") === String(userData?.id || "") ? "You" : chatUser.userData.name}
                      {` • ${formatTime(msg.createdAt)}`}
                    </span>
                  </div>
                ))
              ) : (
                <span className="rs-empty-state">No matching messages</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rs-media">
          <p>Media</p>
          <div>
            {msgImages.map((url, index) => (
              <img
                onClick={() => window.open(url)}
                key={index}
                src={url}
                alt=""
              />
            ))}
          </div>
        </div>
      )}
      <button className="logout-btn" onClick={handleLogout}>Logout</button>
    </div>
  ) : (
    <div className="rs">
      <button className="logout-btn" onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default RightSidebar;
