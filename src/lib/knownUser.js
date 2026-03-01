const KNOWN_USER_STORAGE_KEY = "chat-app-known-user";

const isBrowser = typeof window !== "undefined";

export const getKnownUser = () => {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(KNOWN_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") return null;

    return {
      id: String(parsed.id || ""),
      name: String(parsed.name || ""),
      email: String(parsed.email || ""),
      avatar: String(parsed.avatar || ""),
    };
  } catch {
    return null;
  }
};

export const setKnownUser = (user) => {
  if (!isBrowser || !user) return;

  const payload = {
    id: String(user.id || ""),
    name: String(user.name || ""),
    email: String(user.email || ""),
    avatar: String(user.avatar || ""),
  };

  if (!payload.id && !payload.email) return;

  window.localStorage.setItem(KNOWN_USER_STORAGE_KEY, JSON.stringify(payload));
};
