export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "examforge-theme";

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Tailwind's dark variant is class-based, so resolve "system" ourselves. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function saveTheme(theme: Theme) {
  if (typeof localStorage !== "undefined") {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme);
}
