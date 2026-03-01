import React, { useCallback, useContext, useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Login from "./pages/Login/Login";
import Chat from "./pages/Chat/Chat";
import ProfileUpdate from "./pages/ProfileUpdate/ProfileUpdate";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Notification from "./components/Notification/Notification";
import { NotificationProvider } from "./context/NotificationContext";
import { isDesignPreviewMode, supabase } from "./config/supabase";
import { AppContext } from "./context/AppContextObject";
import {
  applyResolvedTheme,
  applyThemeMode,
  getThemeMode,
  subscribeToSystemThemeChanges,
} from "./lib/theme";

const App = () => {
  const navigate = useNavigate();
  const { loadUserData, clearAppState } = useContext(AppContext);
  const isLoadingUserRef = useRef(false);
  const lastLoadedUidRef = useRef("");
  const lastLoadedAtRef = useRef(0);

  const safeLoadUserData = useCallback(
    async (uid, authUser = null, options = {}) => {
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
        await loadUserData(uid, authUser, options);
        lastLoadedAtRef.current = Date.now();
      } finally {
        isLoadingUserRef.current = false;
      }
    },
    [loadUserData],
  );

  useEffect(() => {
    applyThemeMode(getThemeMode());

    const unsubscribe = subscribeToSystemThemeChanges((nextTheme) => {
      if (getThemeMode() === "system") {
        applyResolvedTheme(nextTheme);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    const isRecoveryLink = type === "recovery" && accessToken && refreshToken;
    if (!isRecoveryLink || window.location.pathname === "/reset-password") return;

    navigate(`/reset-password${window.location.hash}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (isDesignPreviewMode) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password");
        return;
      }

      const isResetFlowRoute =
        typeof window !== "undefined" && window.location.pathname === "/reset-password";

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        if (isResetFlowRoute) return;
        const currentPath =
          typeof window !== "undefined" ? window.location.pathname : "/";
        const preserveForInAppRoute =
          currentPath === "/chat" || currentPath === "/profile-update";
        setTimeout(() => {
          void safeLoadUserData(session.user.id, session.user, {
            preserveCurrentRoute: preserveForInAppRoute,
          });
        }, 0);
      } else if (event === "SIGNED_OUT") {
        clearAppState();
        lastLoadedUidRef.current = "";
        lastLoadedAtRef.current = 0;
        navigate("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [safeLoadUserData, navigate, clearAppState]);

  return (
    <>
      <Notification />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/profile-update" element={<ProfileUpdate />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </>
  );
};

const AppWithProviders = () => (
  <NotificationProvider>
    <App />
  </NotificationProvider>
);

export default AppWithProviders;
