export type ExamPriority = "low" | "medium" | "high" | "urgent";
export type ExamStatus = "planned" | "studying" | "review" | "ready" | "done";

export type ExamRecord = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  exam_date: string;
  location: string | null;
  notes: string | null;
  priority: ExamPriority;
  status: ExamStatus;
  progress: number;
  created_at: string;
  updated_at: string;
};

export const EXAM_PRIORITIES: Array<{
  value: ExamPriority;
  label: string;
  className: string;
}> = [
  { value: "low", label: "Low", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  { value: "medium", label: "Medium", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  { value: "high", label: "High", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  { value: "urgent", label: "Urgent", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
];

export const EXAM_STATUSES: Array<{
  value: ExamStatus;
  label: string;
  className: string;
}> = [
  { value: "planned", label: "Planned", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  { value: "studying", label: "Studying", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { value: "review", label: "Review", className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30" },
  { value: "ready", label: "Ready", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  { value: "done", label: "Done", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
];

export function priorityMeta(priority: ExamPriority) {
  return EXAM_PRIORITIES.find((p) => p.value === priority) ?? EXAM_PRIORITIES[1];
}

export function statusMeta(status: ExamStatus) {
  return EXAM_STATUSES.find((s) => s.value === status) ?? EXAM_STATUSES[0];
}

export function progressBarColor(progress: number) {
  if (progress >= 80) return "bg-emerald-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-amber-500";
  return "bg-rose-500";
}

export function daysUntil(isoDate: string) {
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(isoDate: string) {
  const days = daysUntil(isoDate);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days left`;
}

export function countdownClass(isoDate: string) {
  const days = daysUntil(isoDate);
  if (days < 0) return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  if (days <= 3) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (days <= 7) return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
  if (days <= 14) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}
