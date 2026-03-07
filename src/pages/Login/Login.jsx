import "./Login.css";
import assets from "../../assets/assets";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isDesignPreviewMode,
  signup,
  login,
  loginWithGoogle,
} from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";
import { getKnownUser } from "../../lib/knownUser";

const Login = () => {
  const navigate = useNavigate();
  const { loadUserData } = useContext(AppContext);
  const [currState, setCurrState] = useState("login");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [knownAvatar, setKnownAvatar] = useState("");

  useEffect(() => {
    const knownUser = getKnownUser();
    setKnownAvatar(knownUser?.avatar || "");
    setPassword("");
    setShowPassword(false);
  }, []);

  useEffect(() => {
    setPassword("");
    setShowPassword(false);
  }, [currState]);

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (isDesignPreviewMode) {
      await loadUserData("preview-me", {
        id: "preview-me",
        email: "preview@chatapp.local",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (currState === "signup") {
        const result = await signup(userName, email, password);
        if (result?.ok && !result?.needsEmailVerification && result?.user?.id) {
          await loadUserData(result.user.id, result.user);
          return;
        }
        if (result?.rateLimited) {
          setCurrState("login");
        }
        if (result?.ok && result?.needsEmailVerification) {
          setCurrState("login");
        }
      } else {
        const result = await login(email, password);
        if (result?.ok && result?.user?.id) {
          await loadUserData(result.user.id, result.user);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login-glass">
        <form onSubmit={onSubmitHandler} className="login-form" autoComplete="off">
          <img
            src={knownAvatar || assets.avatar_icon}
            alt="Profile"
            className="login-form-icon"
          />
          <h2>{currState === "signup" ? "Create Account" : "Welcome Back"}</h2>
          <p className="login-subtitle">
            {currState === "signup"
              ? "Create your account to start chatting securely."
              : "Sign in to access your secure dashboard"}
          </p>

          {currState === "signup" && (
            <div className="input-group">
              <label>Name</label>
              <input
                onChange={(e) => setUserName(e.target.value)}
                value={userName}
                type="text"
                placeholder="Your name"
                className="form-input"
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              type="email"
              placeholder="name@company.com"
              className="form-input"
              autoComplete="email"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="input-group">
            <div className="password-row">
              <label>Password</label>
              {currState === "login" ? (
                <p className="forgot-mini" onClick={() => navigate("/forgot-password")}>
                  Forgot?
                </p>
              ) : null}
            </div>
            <div className="password-input-wrap">
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 3L21 21"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.58 10.58A2 2 0 0013.42 13.42"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.88 5.09A9.76 9.76 0 0112 4.8c4.8 0 8.27 3.16 9.5 7.2a10.68 10.68 0 01-3.05 4.66"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.61 6.61A10.73 10.73 0 002.5 12c1.23 4.04 4.7 7.2 9.5 7.2 1.79 0 3.37-.44 4.73-1.17"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 12C3.73 7.96 7.2 4.8 12 4.8s8.27 3.16 9.5 7.2c-1.23 4.04-4.7 7.2-9.5 7.2S3.73 16.04 2.5 12z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
              <input
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="form-input"
                name="chatapp-password"
                autoComplete="new-password"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : currState === "signup"
                ? "Create Account →"
                : "Login →"}
          </button>

          <div className="or-divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <div className="login-alt-actions">
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={isSubmitting}
              className="alt-btn"
            >
              Google
            </button>
          </div>

          <div className="login-forgot">
            {currState === "signup" ? (
              <p className="login-toggle">
                Already have an account?
                <span onClick={() => setCurrState("login")}> Sign in</span>
              </p>
            ) : (
              <p className="login-toggle">
                New here?
                <span onClick={() => setCurrState("signup")}> Create an account</span>
              </p>
            )}

            {isDesignPreviewMode ? (
              <p className="login-toggle">
                Need reset page preview?
                <span onClick={() => navigate("/reset-password")}> Open it</span>
              </p>
            ) : null}
          </div>
        </form>

        <p className="login-secure-note">
          SECURE MESSAGING POWERED BY CHAT-APP
        </p>
      </div>
    </div>
  );
};

export default Login;
