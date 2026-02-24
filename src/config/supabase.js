import { createClient } from "@supabase/supabase-js";
import { toast } from "react-toastify";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (input, init = {}) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input?.url || "";
      const method = (
        init?.method ||
        (typeof input !== "string" && input?.method) ||
        "GET"
      ).toUpperCase();
      const isStorageUpload =
        requestUrl.includes("/storage/v1/object") &&
        (method === "POST" || method === "PUT");

      // Uploads can legitimately take longer than standard DB/auth calls.
      if (isStorageUpload || init.signal) {
        return fetch(input, init);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      return fetch(input, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timeout),
      );
    },
  },
});

const normalizeUsername = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername,
          full_name: username.trim(),
        },
      },
    });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error("Signup failed - no user returned");

    try {
      await ensureUserProfile(user, {
        username: normalizedUsername,
        name: username.trim(),
      });
    } catch (profileError) {
      // If email confirmation is enabled, the user may not have an active session yet.
      console.warn("Profile bootstrap deferred:", profileError.message);
    }

    await supabase.auth.signOut();
    toast.success("Account created! Please login now.");
    return { ok: true };
  } catch (error) {
    console.error("Signup failed:", error);
    toast.error(error.message);
    return { ok: false, error };
  }
};

export const login = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Login failed");
    return { ok: true };
  } catch (error) {
    console.error("Login failed:", error);
    toast.error(error.message);
    return { ok: false, error };
  }
};

export const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  }
};

export const resetPass = async (email) => {
  if (!email) {
    toast.error("Enter your email first");
    return;
  }
  try {
    const { data } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!data) {
      toast.error("Email does not exist");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    toast.success("Reset email sent");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  }
};
