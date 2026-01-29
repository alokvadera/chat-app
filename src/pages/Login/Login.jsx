import "./Login.css";
import assets from "../../assets/assets";
import React, { useState } from "react";
import { signup,login,resetPass } from "../../config/firebase";

const Login = () => {
  const [currState, setCurrState] = useState("login");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const onSubmitHandler = (event) => {
    event.preventDefault();
    if (currState === "signup") {
      signup(userName,email,password)
    }
    else {
      login(email,password)
    }
  }

  return (
    <div className="login">
      <img src={assets.logo_big} alt="Logo" />

      <form onSubmit={onSubmitHandler} className="login-form">
        <h2>{currState === "signup" ? "sign Up" : "login"}</h2>

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
          required
        />

        <input
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          type="password"
          placeholder="Password"
          className="form-input"
          required
        />

        <button type="submit">
          {currState === "signup" ? "Create Account" : "Login"}
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
          {currState === 'login' ? <p className="login-toggle">
              Forgot Password
              <span onClick={() => resetPass(email)}> reset here</span>
            </p>: null}
        </div>
      </form>
    </div>
  );
};

export default Login;
