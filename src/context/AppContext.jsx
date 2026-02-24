import { useCallback, useEffect, useState } from "react";
import { ensureUserProfile, supabase, toUserErrorMessage } from "../config/supabase";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AppContext } from "./AppContextObject";

const AppContextProvider = (props) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState([]);
  const [messagesId, setMessagesId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);

  const loadUserData = useCallback(async (uid, authUser = null) => {
    try {
      let user = authUser;
      if (!user) {
        const {
          data: { user: fetchedUser },
        } = await supabase.auth.getUser();
        user = fetchedUser;
      }
      if (!user) throw new Error("Auth session missing");

      let { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.warn("Initial profile read failed:", error.message);
      }

      if (!data) {
        try {
          await ensureUserProfile(user);
          const refetch = await supabase
            .from("users")
            .select("*")
            .eq("id", uid)
            .maybeSingle();
          data = refetch.data;
          error = refetch.error;
        } catch (bootstrapError) {
          console.warn("Profile bootstrap failed:", bootstrapError.message);
        }
      }

      if (!data) {
        // Keep the user moving forward even when profile bootstrap is blocked by RLS/policies.
        data = {
          id: uid,
          email: user.email || "",
          username: user.user_metadata?.username || "",
          name: "",
          avatar: "",
          bio: "",
          last_seen: Date.now(),
        };
      }

      if (error) {
        console.warn("Profile read error after bootstrap:", error.message);
      }

      setUserData(data);

      if (data.avatar && data.name) {
        navigate("/chat");
      } else {
        navigate("/profile-update");
      }

      // Update lastSeen in background
      supabase.from("users").update({ last_seen: Date.now() }).eq("id", uid);
    } catch (error) {
      console.error("loadUserData error:", error);
      toast.error(toUserErrorMessage(error));
    }
  }, [navigate]);

  useEffect(() => {
    if (!userData) return;

    const buildChatData = async (chatsData) => {
      if (!chatsData || chatsData.length === 0) {
        setChatData([]);
        return;
      }
      const tempData = [];
      for (const item of chatsData) {
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("id", item.rId)
          .maybeSingle();
        if (user) tempData.push({ ...item, userData: user });
      }
      setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt));
    };

    const fetchChats = async () => {
      const { data: chatRow } = await supabase
        .from("chats")
        .select("chats_data")
        .eq("id", userData.id)
        .maybeSingle();
      if (chatRow) await buildChatData(chatRow.chats_data);
    };

    fetchChats();

    const channel = supabase
      .channel(`chats_${userData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=eq.${userData.id}`,
        },
        async (payload) => {
          await buildChatData(payload.new.chats_data);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userData]);

  const value = {
    userData,
    setUserData,
    chatData,
    setChatData,
    loadUserData,
    messages,
    setMessages,
    messagesId,
    setMessagesId,
    chatUser,
    setChatUser,
    chatVisible,
    setChatVisible,
  };

  return (
    <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
  );
};

export default AppContextProvider;
