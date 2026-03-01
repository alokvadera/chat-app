import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import assets from "../../assets/assets";
import {
  isDesignPreviewMode,
  supabase,
  toUserErrorMessage,
} from "../../config/supabase";
import { getKnownUser } from "../../lib/knownUser";
import { useNotificationContext } from "../../context/NotificationContext";
import "./ResetPassword.css";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { notify } = useNotificationContext();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [knownAvatar, setKnownAvatar] = useState("");

  useEffect(() => {
    const knownUser = getKnownUser();
    setKnownAvatar(knownUser?.avatar || "");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapRecoverySession = async () => {
      try {
        if (isDesignPreviewMode) {
          setIsReady(true);
          return;
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (type === "recovery" && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          window.history.replaceState({}, document.title, "/reset-password");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session?.user) {
          notify.error("Invalid or expired reset link. Request a new one.");
          navigate("/", { replace: true });
          return;
        }

        setIsReady(true);
      } catch (error) {
        if (!isMounted) return;
        notify.error(toUserErrorMessage(error));
        navigate("/", { replace: true });
      }
    };

    void bootstrapRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [navigate, notify]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !isReady) return;

    if (password.length < 6) {
      notify.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      notify.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isDesignPreviewMode) {
        notify.success("Password updated in preview mode.");
        navigate("/", { replace: true });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      notify.success("Password updated. Please login with your new password.");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      notify.error(toUserErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reset-password">
      <div className="reset-password-glass">
        <form className="reset-password-form" onSubmit={onSubmit}>
          <img
            src={knownAvatar || assets.avatar_icon}
            alt="Profile"
            className="reset-password-icon"
          />
          <h2>Reset Password</h2>
          <p className="reset-password-subtitle">
            Choose a strong new password for your chat-app account.
          </p>

          <div className="reset-input-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={!isReady || isSubmitting}
            />
          </div>

          <div className="reset-input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={!isReady || isSubmitting}
            />
          </div>

          <button type="submit" disabled={!isReady || isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Password →"}
          </button>
        </form>

        <p className="reset-password-note">SECURE ACCOUNT RECOVERY · CHAT-APP</p>
      </div>
    </div>
  );
};

export default ResetPassword;
