import type { ExamRecord } from "@/lib/exam-planner";
import type { ExamPlannerData } from "@/lib/exam-planner-data";
import { countdownLabel, daysUntil } from "@/lib/exam-planner";

const SHOWN_KEY = "examforge-reminders-shown";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readShown(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function markShown(id: string) {
  const shown = readShown();
  shown[id] = todayKey();
  localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
}

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function reminderPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function checkExamReminders(
  exams: ExamRecord[],
  plannerMap: Record<string, ExamPlannerData>,
) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const shown = readShown();
  const today = todayKey();

  for (const exam of exams) {
    if (exam.status === "done") continue;
    const planner = plannerMap[exam.id];
    if (!planner?.reminders?.enabled) continue;

    const days = daysUntil(exam.exam_date);
    if (!planner.reminders.days_before.includes(days)) continue;

    const notifyKey = `${exam.id}:${days}`;
    if (shown[notifyKey] === today) continue;

    const body =
      days === 0
        ? `${exam.title} is TODAY! Progress: ${exam.progress}%`
        : `${exam.title} — ${countdownLabel(exam.exam_date)}. Progress: ${exam.progress}%`;

    new Notification("ExamForge reminder", {
      body,
      icon: "/favicon.ico",
      tag: notifyKey,
    });
    markShown(notifyKey);
  }
}

/** Run on app load — checks every 30 min while tab is open */
export function useExamReminderLoop(
  exams: ExamRecord[] | undefined,
  plannerMap: Record<string, ExamPlannerData> | undefined,
) {
  if (typeof window === "undefined") return;
  if (!exams?.length || !plannerMap) return;

  checkExamReminders(exams, plannerMap);
  const id = window.setInterval(() => checkExamReminders(exams, plannerMap), 30 * 60 * 1000);
  return () => window.clearInterval(id);
}
