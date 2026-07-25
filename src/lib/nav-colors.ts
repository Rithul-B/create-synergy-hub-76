import type { LucideIcon } from "lucide-react";

export const NAV_COLORS: Record<string, { bg: string; text: string; active: string }> = {
  "/dashboard": { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400", active: "text-violet-600 dark:text-violet-400" },
  "/exams": { bg: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-400", active: "text-rose-600 dark:text-rose-400" },
  "/subjects": { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", active: "text-emerald-600 dark:text-emerald-400" },
  "/chat": { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", active: "text-blue-600 dark:text-blue-400" },
  "/library": { bg: "bg-cyan-500/15", text: "text-cyan-600 dark:text-cyan-400", active: "text-cyan-600 dark:text-cyan-400" },
  "/powerpoint": { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", active: "text-orange-600 dark:text-orange-400" },
  "/audio": { bg: "bg-pink-500/15", text: "text-pink-600 dark:text-pink-400", active: "text-pink-600 dark:text-pink-400" },
  "/video": { bg: "bg-purple-500/15", text: "text-purple-600 dark:text-purple-400", active: "text-purple-600 dark:text-purple-400" },
  "/settings": { bg: "bg-slate-500/15", text: "text-slate-600 dark:text-slate-400", active: "text-slate-600 dark:text-slate-400" },
};

export function navColor(to: string) {
  return NAV_COLORS[to] ?? { bg: "bg-primary/15", text: "text-primary", active: "text-primary" };
}

export function navIconClass(to: string, active: boolean, size = "h-4 w-4") {
  const c = navColor(to);
  return { wrap: active ? c.bg : "", icon: `${size} ${active ? c.active : c.text}` };
}
