import React, { useContext, useMemo, useState } from "react";
import "./RightSidebar.css";
import assets from "../../assets/assets";
import { isDesignPreviewMode, supabase } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { useNavigate } from "react-router-dom";
import { getPinnedMessages, formatFileSize, getFileCategory } from "../../lib/messageUtils";

const MEDIA_TABS = [
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
  { key: "files", label: "Files" },
  { key: "links", label: "Links" },
];

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
    presenceUsers,
  } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [mediaTab, setMediaTab] = useState("photos");
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const chatUserAvatar = chatUser?.userData?.avatar || assets.avatar_icon;

  const msgImages = useMemo(
    () => messages.filter((msg) => msg.image).map((msg) => ({ url: msg.image, createdAt: msg.createdAt })),
    [messages],
  );

  const msgVideos = useMemo(
    () => messages.filter((msg) => msg.file && getFileCategory(msg.file.type || msg.file.name) === "video"),
    [messages],
  );

  const msgFiles = useMemo(
    () => messages.filter((msg) => msg.file && getFileCategory(msg.file.type || msg.file.name) !== "video"),
    [messages],
  );

  const msgLinks = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return messages
      .filter((msg) => typeof msg?.text === "string" && urlRegex.test(msg.text))
      .map((msg) => {
        const matches = msg.text.match(urlRegex);
        return (matches || []).map((url) => ({ url, createdAt: msg.createdAt, sId: msg.sId }));
      })
      .flat();
  }, [messages]);

  const textMessages = useMemo(
    () => messages.filter((msg) => typeof msg?.text === "string" && msg.text.trim()),
    [messages],
  );

  const pinnedMessages = useMemo(() => getPinnedMessages(messages), [messages]);

  const searchedMessages = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return textMessages.filter((msg) => String(msg.text || "").toLowerCase().includes(query)).slice(-15).reverse();
  }, [searchTerm, textMessages]);

  const firstMessageDate = useMemo(() => {
    const first = messages.find((msg) => msg?.createdAt);
    if (!first?.createdAt) return "-";
    const parsed = new Date(first.createdAt);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }, [messages]);

  const isOnline = isUserOnline(chatUser?.userData);

  const formatLastSeen = () => {
    const lastSeen = Number(chatUser?.userData?.last_seen || 0);
    if (!lastSeen) return "Offline";
    const diff = Date.now() - lastSeen;
    if (diff < 60000) return "Last seen just now";
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    return `Last seen ${new Date(lastSeen).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  const formatTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const hour = parsed.getHours();
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:${minute} PM` : `${hour}:${minute} AM`;
  };

  const handleLogout = async () => {
    if (isDesignPreviewMode) { clearAppState(); navigate("/"); return; }
    await supabase.auth.signOut();
  };

  const renderMediaContent = () => {
    switch (mediaTab) {
      case "photos":
        return msgImages.length > 0 ? (
          <div className="rs-media-grid">
            {msgImages.map((item, index) => (
              <img onClick={() => window.open(item.url)} key={index} src={item.url} alt="" />
            ))}
          </div>
        ) : <span className="rs-empty-state">No photos shared yet</span>;

      case "videos":
        return msgVideos.length > 0 ? (
          <div className="rs-file-list">
            {msgVideos.map((msg, index) => (
              <a key={index} href={msg.file.url} target="_blank" rel="noopener noreferrer" className="rs-file-item">
                <span className="rs-file-icon">🎬</span>
                <div className="rs-file-info">
                  <span className="rs-file-name">{msg.file.name || "Video"}</span>
                  <span className="rs-file-size">{formatFileSize(msg.file.size)}</span>
                </div>
              </a>
            ))}
          </div>
        ) : <span className="rs-empty-state">No videos shared yet</span>;

      case "files":
        return msgFiles.length > 0 ? (
          <div className="rs-file-list">
            {msgFiles.map((msg, index) => (
              <a key={index} href={msg.file.url} target="_blank" rel="noopener noreferrer" className="rs-file-item">
                <span className="rs-file-icon">{getFileCategory(msg.file.type || msg.file.name) === "pdf" ? "📄" : "📎"}</span>
                <div className="rs-file-info">
                  <span className="rs-file-name">{msg.file.name || "File"}</span>
                  <span className="rs-file-size">{formatFileSize(msg.file.size)}</span>
                </div>
              </a>
            ))}
          </div>
        ) : <span className="rs-empty-state">No files shared yet</span>;

      case "links":
        return msgLinks.length > 0 ? (
          <div className="rs-file-list">
            {msgLinks.map((item, index) => (
              <a key={index} href={item.url} target="_blank" rel="noopener noreferrer" className="rs-file-item rs-link-item">
                <span className="rs-file-icon">🔗</span>
                <span className="rs-link-url">{item.url}</span>
              </a>
            ))}
          </div>
        ) : <span className="rs-empty-state">No links shared yet</span>;

      default:
        return null;
    }
  };

  return chatUser ? (
    <div className="rs">
      <div className="rs-profile">
        <img src={chatUserAvatar} alt="" />
        <h3>{chatUser.userData.name}</h3>
        <span className={`rs-status ${isOnline ? "online" : "away"}`}>
          {isOnline ? "Online" : formatLastSeen()}
        </span>
        {chatUser.userData.username ? (
          <span className="rs-username">@{chatUser.userData.username}</span>
        ) : null}
        <p>{chatUser.userData.bio}</p>
      </div>
      <hr />

      {/* Pinned messages toggle */}
      {pinnedMessages.length > 0 ? (
        <div className="rs-pinned-toggle" onClick={() => setShowPinnedPanel((p) => !p)}>
          <span>📌 {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? "s" : ""}</span>
          <span className="rs-toggle-arrow">{showPinnedPanel ? "▲" : "▼"}</span>
        </div>
      ) : null}

      {showPinnedPanel ? (
        <div className="rs-pinned-panel">
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="rs-pinned-item">
              <p>{msg.text || (msg.image ? "📷 Image" : "📎 File")}</p>
              <span>{formatTime(msg.createdAt)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {chatInfoPanelOpen ? (
        <div className="rs-info-panel">
          <div className="rs-info-head">
            <p>Chat Info</p>
            <button type="button" className="rs-close-btn" onClick={() => setChatInfoPanelOpen(false)}
              aria-label="Close chat info" title="Close">✕</button>
          </div>

          <div className="rs-stats-grid">
            <div className="rs-stat-card">
              <span>Messages</span>
              <strong>{messages.length}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Media</span>
              <strong>{msgImages.length + msgVideos.length}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Files</span>
              <strong>{msgFiles.length}</strong>
            </div>
            <div className="rs-stat-card">
              <span>Since</span>
              <strong>{firstMessageDate}</strong>
            </div>
          </div>

          <div className="rs-search-section">
            <p>Search in chat</p>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}
              type="text" placeholder="Find message text" />
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
          <div className="rs-media-tabs">
            {MEDIA_TABS.map((tab) => (
              <button key={tab.key} type="button"
                className={`rs-media-tab ${mediaTab === tab.key ? "active" : ""}`}
                onClick={() => setMediaTab(tab.key)}>{tab.label}</button>
            ))}
          </div>
          <div className="rs-media-content">
            {renderMediaContent()}
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
