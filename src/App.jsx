import React, { useCallback, useContext, useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Login from "./pages/Login/Login";
import Chat from "./pages/Chat/Chat";
import ProfileUpdate from "./pages/ProfileUpdate/ProfileUpdate";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "./config/supabase";
import { AppContext } from "./context/AppContextObject";
import { Analytics } from "@vercel/analytics/react";

const App = () => {
  const navigate = useNavigate();
  const { loadUserData } = useContext(AppContext);
  const isLoadingUserRef = useRef(false);
  const lastLoadedUidRef = useRef("");
  const lastLoadedAtRef = useRef(0);

  const safeLoadUserData = useCallback(
    async (uid, authUser = null) => {
      if (!uid) return;
      const now = Date.now();
      if (
        lastLoadedUidRef.current === uid &&
        now - lastLoadedAtRef.current < 2000
      ) {
        return;
      }
      if (isLoadingUserRef.current && lastLoadedUidRef.current === uid) return;

      isLoadingUserRef.current = true;
      lastLoadedUidRef.current = uid;
      try {
        await loadUserData(uid, authUser);
        lastLoadedAtRef.current = Date.now();
      } finally {
        isLoadingUserRef.current = false;
      }
    },
    [loadUserData],
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        setTimeout(() => {
          void safeLoadUserData(session.user.id, session.user);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        lastLoadedUidRef.current = "";
        lastLoadedAtRef.current = 0;
        navigate("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [safeLoadUserData, navigate]);

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile-update" element={<ProfileUpdate />} />
      </Routes>
      <Analytics />
    </>
  );
};

export default App;
