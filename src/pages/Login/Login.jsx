import "./Login.css";
import assets from "../../assets/assets";
import React, { useContext, useEffect, useRef, useState } from "react";
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
  const [passwordInputReady, setPasswordInputReady] = useState(false);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    const knownUser = getKnownUser();
    setKnownAvatar(knownUser?.avatar || "");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setPasswordInputReady(false);

    const clearAutofill = window.setTimeout(() => {
      setEmail("");
      setPassword("");
      if (emailInputRef.current) emailInputRef.current.value = "";
      if (passwordInputRef.current) passwordInputRef.current.value = "";
    }, 50);

    return () => window.clearTimeout(clearAutofill);
  }, []);

  useEffect(() => {
    setPassword("");
    setShowPassword(false);
    setPasswordInputReady(false);
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
    <div className="lg-page">
      {/* Background decoration */}
      <div className="lg-glow" />
      <div className="lg-glow lg-glow--2" />

      {/* Brand header */}
      <a className="lg-brand" onClick={() => navigate("/")} tabIndex={0}>
        <img src="/logo-icon.svg" alt="" />
        <span>Chatly</span>
      </a>

      <div className="lg-container">
        {/* Left — editorial side */}
        <div className="lg-side">
          <div className="lg-side-content">
            <p className="lg-side-label">
              <span className="lg-dot" />
              Secure &amp; Realtime
            </p>
            <h1>
              Conversations that <em>matter.</em>
            </h1>
            <p className="lg-side-sub">
              End-to-end encrypted messaging with a design language
              that respects your attention.
            </p>

            {/* mini chat mock */}
            <div className="lg-mini-mock">
              <div className="lg-mm-msg lg-mm-recv">
                <div className="lg-mm-avatar">A</div>
                <div className="lg-mm-bubble">Hey, are you free for a call? &#128222;</div>
              </div>
              <div className="lg-mm-msg lg-mm-sent">
                <div className="lg-mm-bubble">Sure! Give me 5 minutes &#128640;</div>
              </div>
              <div className="lg-mm-msg lg-mm-recv">
                <div className="lg-mm-avatar">A</div>
                <div className="lg-mm-bubble lg-mm-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="lg-form-wrap">
          <form onSubmit={onSubmitHandler} className="lg-form" autoComplete="off">
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="login-decoy"
              tabIndex="-1"
              aria-hidden="true"
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="login-decoy"
              tabIndex="-1"
              aria-hidden="true"
            />
            <img
              src={knownAvatar || assets.avatar_icon}
              alt="Profile"
              className="lg-avatar"
            />
            <h2>{currState === "signup" ? "Create Account" : "Welcome Back"}</h2>
            <p className="lg-subtitle">
              {currState === "signup"
                ? "Join Chatly and start secure conversations."
                : "Sign in to continue to Chatly"}
            </p>

            {/* Google button — first, prominent */}
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={isSubmitting}
              className="lg-google"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="lg-divider">
              <span>or sign in with email</span>
            </div>

            {currState === "signup" && (
              <div className="lg-field">
                <label>Name</label>
                <input
                  onChange={(e) => setUserName(e.target.value)}
                  value={userName}
                  type="text"
                  className="lg-input"
                  required
                />
              </div>
            )}

            <div className="lg-field">
              <label>Email</label>
              <input
                ref={emailInputRef}
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                type="email"
                className="lg-input"
                name="chatapp-email"
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="lg-field">
              <div className="lg-field-row">
                <label>Password</label>
                {currState === "login" && (
                  <span className="lg-forgot" onClick={() => navigate("/forgot-password")}>
                    Forgot?
                  </span>
                )}
              </div>
              <div className="lg-pw-wrap">
                <input
                  ref={passwordInputRef}
                  onChange={(e) => setPassword(e.target.value)}
                  value={password}
                  type={showPassword ? "text" : "password"}
                  className="lg-input"
                  name="chatapp-password"
                  autoComplete="off"
                  readOnly={!passwordInputReady}
                  onFocus={() => setPasswordInputReady(true)}
                  onPointerDown={() => setPasswordInputReady(true)}
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="lg-pw-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M10.58 10.58A2 2 0 0013.42 13.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9.88 5.09A9.76 9.76 0 0112 4.8c4.8 0 8.27 3.16 9.5 7.2a10.68 10.68 0 01-3.05 4.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.61 6.61A10.73 10.73 0 002.5 12c1.23 4.04 4.7 7.2 9.5 7.2 1.79 0 3.37-.44 4.73-1.17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M2.5 12C3.73 7.96 7.2 4.8 12 4.8s8.27 3.16 9.5 7.2c-1.23 4.04-4.7 7.2-9.5 7.2S3.73 16.04 2.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait..."
                : currState === "signup"
                  ? "Create Account"
                  : "Sign In"}
              {!isSubmitting && <span className="lg-arrow">&#8594;</span>}
            </button>

            <p className="lg-switch">
              {currState === "signup" ? (
                <>
                  Already have an account?{" "}
                  <span onClick={() => setCurrState("login")}>Sign in</span>
                </>
              ) : (
                <>
                  New to Chatly?{" "}
                  <span onClick={() => setCurrState("signup")}>Create an account</span>
                </>
              )}
            </p>

            {isDesignPreviewMode && (
              <p className="lg-switch">
                Need reset page preview?{" "}
                <span onClick={() => navigate("/reset-password")}>Open it</span>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
