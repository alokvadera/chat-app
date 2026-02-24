import React, { useContext, useEffect, useState } from "react";
import "./LeftSidebar.css";
import assets from "../../assets/assets";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { toast } from "react-toastify";

const LeftSidebar = () => {
  const navigate = useNavigate();
  const {
    userData,
    chatData,
    chatUser,
    setChatUser,
    setMessagesId,
    messagesId,
    chatVisible,
    setChatVisible,
  } = useContext(AppContext);

  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // ─── Search user by username ──────────────────────────────────────────────
  const inputHandler = async (e) => {
    try {
      const input = e.target.value;
      setSearchTerm(input);
      if (!input) {
        setShowSearch(false);
        setUser(null);
        return;
      }

      setShowSearch(true);

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`username.ilike.%${input}%,name.ilike.%${input}%`)
        .limit(10);

      if (error || !data?.length) {
        setUser(null);
        return;
      }

      // show the first user who is not me and not already in chats
      const candidate = data.find(
        (item) =>
          item.id !== userData.id && !chatData.some((chat) => chat.rId === item.id),
      );
      setUser(candidate || null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ─── Add new chat ─────────────────────────────────────────────────────────
  const addChat = async () => {
    try {
      // Create new messages row
      const { data: newMsg, error: msgError } = await supabase
        .from("messages")
        .insert({ messages: [] })
        .select()
        .single();

      if (msgError) throw msgError;

      const newMessageId = newMsg.id;

      // Update the found user's chats_data
      const { data: theirChat } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", user.id)
        .single();

      await supabase
        .from("chats")
        .update({
          chats_data: [
            ...(theirChat?.chats_data || []),
            {
              messageId: newMessageId,
              lastMessage: "",
              rId: userData.id,
              updatedAt: Date.now(),
              messageSeen: true,
            },
          ],
        })
        .eq("id", user.id);

      // Update current user's chats_data
      const { data: myChat } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", userData.id)
        .single();

      await supabase
        .from("chats")
        .update({
          chats_data: [
            ...(myChat?.chats_data || []),
            {
              messageId: newMessageId,
              lastMessage: "",
              rId: user.id,
              updatedAt: Date.now(),
              messageSeen: true,
            },
          ],
        })
        .eq("id", userData.id);

      // Open this new chat immediately
      setChat({
        messageId: newMessageId,
        lastMessage: "",
        rId: user.id,
        updatedAt: Date.now(),
        messageSeen: true,
        userData: user,
      });

      setShowSearch(false);
      setChatVisible(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ─── Open a chat and mark as seen ────────────────────────────────────────
  const setChat = async (item) => {
    try {
      setMessagesId(item.messageId);
      setChatUser(item);

      // Mark as seen
      const { data: chatRow } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", userData.id)
        .single();

      const chatsData = [...(chatRow?.chats_data || [])];
      const chatIndex = chatsData.findIndex(
        (c) => c.messageId === item.messageId,
      );

      if (chatIndex !== -1) {
        chatsData[chatIndex].messageSeen = true;
        await supabase
          .from("chats")
          .update({ chats_data: chatsData })
          .eq("id", userData.id);
      }

      setChatVisible(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ─── Keep chatUser data fresh when chatData updates ───────────────────────
  useEffect(() => {
    const updateChatUserData = async () => {
      if (chatUser) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", chatUser.userData.id)
          .single();

        if (data) setChatUser((prev) => ({ ...prev, userData: data }));
      }
    };
    updateChatUserData();
  }, [chatData, chatUser, setChatUser]);

  return (
    <div className={`ls ${chatVisible ? "hidden" : ""}`}>
      <div className="ls-top">
        <div className="ls-nav">
          <img src={assets.logo} className="logo" alt="" />
          <div className="menu">
            <img src={assets.menu_icon} alt="" />
            <div className="sub-menu">
              <p onClick={() => navigate("/profile-update")}>Edit Profile</p>
              <hr />
              <p onClick={async () => await supabase.auth.signOut()}>Logout</p>
            </div>
          </div>
        </div>
        <div className="ls-search">
          <img src={assets.search_icon} alt="" />
          <input
            onChange={inputHandler}
            value={searchTerm}
            type="text"
            placeholder="Search by username or name"
          />
        </div>
      </div>

      <div className="ls-list">
        {showSearch && user ? (
          <div onClick={addChat} className="friends add-user">
            <img src={user.avatar || assets.avatar_icon} alt="" />
            <p>{user.name}</p>
          </div>
        ) : (
          chatData.map((item, index) => (
            <div
              onClick={() => setChat(item)}
              key={index}
              className={`friends ${
                item.messageSeen || item.messageId === messagesId
                  ? ""
                  : "border"
              }`}
            >
              <img src={item.userData.avatar || assets.avatar_icon} alt="" />
              <div>
                <p>{item.userData.name}</p>
                <span>{item.lastMessage}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;
