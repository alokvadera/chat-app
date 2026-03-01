const DEFAULT_USER_PREFERENCES = {
  profile_visibility: "public",
  typing_indicators: "on",
  allow_audio_calls: true,
  allow_video_calls: true,
};

const normalizeVisibility = (value) => (value === "private" ? "private" : "public");

const normalizeTypingIndicators = (value) => (value === "off" ? "off" : "on");
const normalizeCallAllowance = (value) => value !== false;

const getStorageKey = (userId) => `chatapp:user_preferences:${String(userId || "").trim()}`;

export const normalizeUserPreferences = (source = {}, fallback = {}) => {
  const merged = {
    ...DEFAULT_USER_PREFERENCES,
    ...(fallback || {}),
    ...(source || {}),
  };

  return {
    ...source,
    profile_visibility: normalizeVisibility(merged.profile_visibility),
    typing_indicators: normalizeTypingIndicators(merged.typing_indicators),
    allow_audio_calls: normalizeCallAllowance(merged.allow_audio_calls),
    allow_video_calls: normalizeCallAllowance(merged.allow_video_calls),
  };
};

export const getUserPreferencesFromStorage = (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || typeof window === "undefined") {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(normalizedUserId));
    if (!raw) return { ...DEFAULT_USER_PREFERENCES };
    const parsed = JSON.parse(raw);
    return normalizeUserPreferences(parsed);
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
};

export const saveUserPreferencesToStorage = (userId, preferences = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || typeof window === "undefined") return;

  const normalizedPrefs = normalizeUserPreferences(preferences);

  try {
    window.localStorage.setItem(getStorageKey(normalizedUserId), JSON.stringify(normalizedPrefs));
  } catch {
    // ignore storage write failures
  }
};

export const getDefaultUserPreferences = () => ({ ...DEFAULT_USER_PREFERENCES });
