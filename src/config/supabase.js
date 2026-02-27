import { createClient } from "@supabase/supabase-js";
import { toast } from "react-toastify";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Enable OAuth callback detection
  },
});

const normalizeUsername = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

const AUTH_TIMEOUT_MS = 15000;

const withTimeout = async (
  promise,
  timeoutMs = AUTH_TIMEOUT_MS,
  timeoutMessage = "Request timed out. Please try again.",
) => {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const isRateLimitError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("security purposes")
  );
};

const isDev = import.meta.env.DEV;
const logDevError = (...args) => {
  if (isDev) console.error(...args);
};
const logDevWarn = (...args) => {
  if (isDev) console.warn(...args);
};

export const toUserErrorMessage = (error) => {
  const message = error?.message || String(error || "Unknown error");
  const lower = message.toLowerCase();

  if (isRateLimitError(error)) {
    return "Email rate limit reached. Wait a minute, then try again or login if account is already created.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please verify your email, then login.";
  }

  if (lower.includes("user already registered")) {
    return "Account already exists. Please login.";
  }

  if (lower.includes("failed to fetch") || lower.includes("timed out")) {
    return "Cannot reach server right now. Check your network and try again.";
  }

  if (lower.includes("signal is aborted")) {
    return "Request was interrupted before reaching Supabase. Please retry.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("violates row-level security policy") ||
    lower.includes("permission denied")
  ) {
    return "You are not allowed to perform this action.";
  }

  if (lower.includes("jwt") || lower.includes("unauthorized")) {
    return "Session expired. Please login again.";
  }

  return "Something went wrong. Please try again.";
};

export const ensureUserProfile = async (user, fallback = {}) => {
  if (!user?.id) throw new Error("Missing auth user");

  const { data: existingUser, error: userReadError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (userReadError) throw userReadError;

  const cleanedUsername = normalizeUsername(
    fallback.username || user.user_metadata?.username || user.email?.split("@")[0],
  );
  const safeUsername = cleanedUsername || `user_${user.id.slice(0, 8)}`;
  const safeName =
    fallback.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  if (!existingUser) {
    const { error: userInsertError } = await supabase.from("users").insert({
      id: user.id,
      username: safeUsername,
      email: user.email,
      name: safeName,
      avatar: "",
      bio: "Hey there! I am using chat-app.",
      last_seen: Date.now(),
    });
    if (userInsertError) throw userInsertError;
  }

  const { data: existingChat, error: chatReadError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (chatReadError) throw chatReadError;

  if (!existingChat) {
    const { error: chatInsertError } = await supabase.from("chats").insert({
      id: user.id,
      chats_data: [],
    });
    if (chatInsertError) throw chatInsertError;
  }
};

export const signup = async (username, email, password) => {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      toast.error("Please enter a valid username");
      return { ok: false };
    }

    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: normalizedUsername,
            full_name: username.trim(),
          },
        },
      }),
      AUTH_TIMEOUT_MS,
      "Signup request timed out. Please check network and try again.",
    );
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error("Signup failed - no user returned");
    const hasSession = Boolean(data.session);

    try {
      await ensureUserProfile(user, {
        username: normalizedUsername,
        name: username.trim(),
      });
    } catch (profileError) {
      // If email confirmation is enabled, the user may not have an active session yet.
      logDevWarn("Profile bootstrap deferred:", profileError.message);
    }

    if (hasSession) {
      toast.success("Account created. Continue to complete your profile.");
      return { ok: true, needsEmailVerification: false, user };
    }

    toast.success("Account created. Please verify email, then login.");
    return { ok: true, needsEmailVerification: true, user };
  } catch (error) {
    logDevError("Signup failed:", error);
    toast.error(toUserErrorMessage(error));
    return { ok: false, error, rateLimited: isRateLimitError(error) };
  }
};

export const login = async (email, password) => {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      AUTH_TIMEOUT_MS,
      "Login request timed out. Please check network and try again.",
    );
    if (error) throw error;
    if (!data.user) throw new Error("Login failed");
    return { ok: true, user: data.user, session: data.session };
  } catch (error) {
    logDevError("Login failed:", error);
    toast.error(toUserErrorMessage(error));
    return { ok: false, error };
  }
};

export const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    logDevError(error);
    toast.error(toUserErrorMessage(error));
  }
};

export const resetPass = async (email) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    toast.error("Enter your email first");
    return;
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: "https://chatappalokvadera.dev/reset-password",
    });
    if (error) throw error;
    toast.success("Password reset email sent. Check your inbox.");
  } catch (error) {
    logDevError(error);
    toast.error(toUserErrorMessage(error));
  }
};

// Google OAuth login
export const loginWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } catch (error) {
    logDevError("Google login failed:", error);
    toast.error(toUserErrorMessage(error));
  }
};
