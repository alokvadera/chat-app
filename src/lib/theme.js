export const THEME_STORAGE_KEY = "chat-app-theme";
export const THEME_MODE_STORAGE_KEY = "chat-app-theme-mode";

const isBrowser = typeof window !== "undefined";

const normalizeTheme = (value) => (value === "light" ? "light" : "dark");
const normalizeThemeMode = (value) => {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
};

export const getSystemTheme = () => {
  if (!isBrowser) return "dark";
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
  return prefersLight ? "light" : "dark";
};

export const getThemeMode = () => {
  if (!isBrowser) return "dark";

  const savedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (savedMode) return normalizeThemeMode(savedMode);

  const legacyTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (legacyTheme === "light" || legacyTheme === "dark") return legacyTheme;

  return "system";
};

export const resolveTheme = (mode) =>
  normalizeThemeMode(mode) === "system" ? getSystemTheme() : normalizeTheme(mode);

export const applyResolvedTheme = (theme) => {
  if (!isBrowser) return;
  document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
};

export const getPreferredTheme = () => {
  return resolveTheme(getThemeMode());
};

export const applyThemeMode = (mode) => {
  if (!isBrowser) return;

  const normalizedMode = normalizeThemeMode(mode);
  const resolvedTheme = resolveTheme(normalizedMode);
  applyResolvedTheme(resolvedTheme);
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, normalizedMode);
  window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
};

export const applyTheme = (theme) => {
  applyThemeMode(normalizeTheme(theme));
};

export const subscribeToSystemThemeChanges = (onThemeChange) => {
  if (!isBrowser || typeof onThemeChange !== "function") return () => {};

  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const handler = (event) => {
    onThemeChange(event.matches ? "light" : "dark");
  };

  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
};
