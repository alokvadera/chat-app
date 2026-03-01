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
  }, []);

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
        <form onSubmit={onSubmitHandler} className="login-form">
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
                {showPassword ? "🙈" : "👁️"}
              </button>
              <input
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="form-input"
                autoComplete={currState === "signup" ? "new-password" : "current-password"}
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
