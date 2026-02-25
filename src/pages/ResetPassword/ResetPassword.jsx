import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase, toUserErrorMessage } from "../../config/supabase";
import "./ResetPassword.css";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrapRecoverySession = async () => {
      try {
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
          toast.error("Invalid or expired reset link. Request a new one.");
          navigate("/", { replace: true });
          return;
        }

        setIsReady(true);
      } catch (error) {
        if (!isMounted) return;
        toast.error(toUserErrorMessage(error));
        navigate("/", { replace: true });
      }
    };

    void bootstrapRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !isReady) return;

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated. Please login with your new password.");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(toUserErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reset-password">
      <form className="reset-password-form" onSubmit={onSubmit}>
        <h2>Reset Password</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          required
          disabled={!isReady || isSubmitting}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          required
          disabled={!isReady || isSubmitting}
        />
        <button type="submit" disabled={!isReady || isSubmitting}>
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
