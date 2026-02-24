import React, { useContext, useEffect, useMemo, useState } from "react";
import "./RightSidebar.css";
import assets from "../../assets/assets";
import { supabase } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";

const RightSidebar = () => {
  const { chatUser, messages } = useContext(AppContext);
  const [now, setNow] = useState(() => Date.now());
  const chatUserAvatar = chatUser?.userData?.avatar || assets.avatar_icon;

  const msgImages = useMemo(
    () => messages.filter((msg) => msg.image).map((msg) => msg.image),
    [messages],
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const isOnline =
    now - (chatUser?.userData?.last_seen ? Number(chatUser.userData.last_seen) : 0) <=
    70000;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return chatUser ? (
    <div className="rs">
      <div className="rs-profile">
        <img src={chatUserAvatar} alt="" />
        <h3>
          {isOnline ? (
            <img src={assets.green_dot} className="dot" alt="" />
          ) : null}
          {chatUser.userData.name}
        </h3>
        <p>{chatUser.userData.bio}</p>
      </div>
      <hr />
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
      <button onClick={handleLogout}>Logout</button>
    </div>
  ) : (
    <div className="rs">
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default RightSidebar;
