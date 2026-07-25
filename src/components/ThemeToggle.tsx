import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, saveTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function isDark(theme: Theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark(readTheme()));
    setMounted(true);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(isDark(readTheme()));
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    saveTheme(next);
    applyTheme(next);
    setDark(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent",
        className,
      )}
    >
      {mounted && dark ? (
        <Sun className="h-4 w-4 text-amber-500" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-500" />
      )}
      <span className="hidden sm:inline">
        {mounted ? (dark ? "Light mode" : "Dark mode") : "Theme"}
      </span>
    </button>
  );
}
