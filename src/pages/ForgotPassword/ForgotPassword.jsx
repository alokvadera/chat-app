import React, { useEffect, useState } from "react";
import "./ForgotPassword.css";
import assets from "../../assets/assets";
import { useNavigate } from "react-router-dom";
import {
  isDesignPreviewMode,
  toUserErrorMessage,
} from "../../config/supabase";
import { useNotificationContext } from "../../context/NotificationContext";
import { getKnownUser } from "../../lib/knownUser";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { notify } = useNotificationContext();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [knownAvatar, setKnownAvatar] = useState("");

  useEffect(() => {
    const knownUser = getKnownUser();
    setKnownAvatar(knownUser?.avatar || "");
  }, []);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail) {
      notify.error("Please enter your email address");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isDesignPreviewMode) {
        setIsEmailSent(true);
        notify.success("Check your email for password reset link");
        setTimeout(() => {
          navigate("/");
        }, 3000);
        return;
      }

      // Call the resetPass function from supabase config
      // We'll modify it to return success/error instead of showing toast
      const cleanedEmail = cleanEmail;
      const { error } = await (
        await import("../../config/supabase")
      ).supabase.auth.resetPasswordForEmail(cleanedEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });

      if (error) throw error;

      setIsEmailSent(true);
      setEmail("");
      notify.success("Password reset link sent! Check your email.");

      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error) {
      console.error(error);
      notify.error(toUserErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="forgot-password">
      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <div className="forgot-head">
            <img
              className="forgot-avatar"
              src={knownAvatar || assets.avatar_icon}
              alt="Profile"
            />
            <h2>Forgot Your Password?</h2>
            <p>
              {isEmailSent
                ? "Check your email for reset instructions"
                : "Let us help you reset it"}
            </p>
          </div>

          {!isEmailSent ? (
            <form onSubmit={handleSendEmail} className="forgot-form">
              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                  required
                />
              </div>

              <button type="submit" disabled={isSubmitting} className="send-btn">
                {isSubmitting ? "Sending..." : "Send Reset Email →"}
              </button>

              <p className="back-link">
                Remember your password?{" "}
                <span onClick={() => navigate("/")}> Back to login</span>
              </p>
            </form>
          ) : (
            <div className="email-sent-message">
              <div className="success-icon">✓</div>
              <p>Email sent successfully!</p>
              <p className="sub-text">
                Follow the link in your email to reset your password.
              </p>
              <button
                onClick={() => navigate("/")}
                className="back-to-login-btn"
              >
                Back to Login
              </button>
            </div>
          )}

          <p className="forgot-secure-note">
            SECURE MESSAGING POWERED BY CHAT-APP
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
