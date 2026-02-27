import "./Login.css";
import assets from "../../assets/assets";
import React, { useContext, useState } from "react";
import { signup, login, resetPass, loginWithGoogle } from "../../config/supabase";
import { AppContext } from "../../context/AppContextObject";

const Login = () => {
  const { loadUserData } = useContext(AppContext);
  const [currState, setCurrState] = useState("login");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

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
      <img src={assets.logo_big} alt="Logo" />

      <form onSubmit={onSubmitHandler} className="login-form">
        <h2>{currState === "signup" ? "Sign Up" : "Login"}</h2>

        {currState === "signup" && (
          <input
            onChange={(e) => setUserName(e.target.value)}
            value={userName}
            type="text"
            placeholder="Name"
            className="form-input"
            required
          />
        )}

        <input
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            type="email"
            placeholder="Email"
            className="form-input"
            disabled={isSubmitting}
            required
          />

        <input
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            type="password"
            placeholder="Password"
            className="form-input"
            disabled={isSubmitting}
            required
          />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Please wait..."
            : currState === "signup"
              ? "Create Account"
              : "Login"}
        </button>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={isSubmitting}
        >
          Continue with Google
        </button>

        <div className="login-term">
          <input type="checkbox" required />
          <p>Agree to terms and conditions</p>
        </div>

        <div className="login-forgot">
          {currState === "signup" ? (
            <p className="login-toggle">
              Already have an account?
              <span onClick={() => setCurrState("login")}> Click here</span>
            </p>
          ) : (
            <p className="login-toggle">
              Create an account
              <span onClick={() => setCurrState("signup")}> Click here</span>
            </p>
          )}
          {currState === "login" ? (
            <p className="login-toggle">
              Forgot Password
              <span onClick={() => resetPass(email)}> reset here</span>
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
};

export default Login;
