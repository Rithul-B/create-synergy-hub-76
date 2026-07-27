import { supabase } from "@/integrations/supabase/client";
import type { ExamPriority, ExamRecord, ExamStatus } from "@/lib/exam-planner";

const LOCAL_KEY = "examforge-exams";
const PLANNER_LOCAL_KEY = "examforge-planner";

function readLocal(userId: string): ExamRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as ExamRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * One-time lift of exams (and their planner data) that were saved on this
 * device before the cloud tables existed.
 */
async function migrateLocalExams(userId: string) {
  const local = readLocal(userId);
  if (local.length === 0) return;

  let plannerMap: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(`${PLANNER_LOCAL_KEY}:${userId}`);
    plannerMap = raw ? JSON.parse(raw) : {};
  } catch {
    plannerMap = {};
  }

  const rows = local.map((exam) => ({
    id: exam.id,
    user_id: userId,
    subject_id: exam.subject_id ?? null,
    title: exam.title,
    exam_date: exam.exam_date.slice(0, 10),
    location: exam.location ?? null,
    notes: exam.notes ?? null,
    priority: exam.priority,
    status: exam.status,
    progress: exam.progress ?? 0,
    planner_data: (plannerMap[exam.id] ?? {}) as never,
  }));

  const { error } = await supabase.from("exams").upsert(rows, { onConflict: "id" });
  if (error) return;

  localStorage.removeItem(`${LOCAL_KEY}:${userId}`);
  localStorage.removeItem(`${PLANNER_LOCAL_KEY}:${userId}`);
}

export async function fetchExams(): Promise<{ exams: ExamRecord[]; localOnly: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { exams: [], localOnly: false };

  await migrateLocalExams(auth.user.id);

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .order("exam_date", { ascending: true });

  if (error) throw new Error(error.message);
  return { exams: (data ?? []) as unknown as ExamRecord[], localOnly: false };
}

export type ExamInput = {
  title: string;
  exam_date: string;
  subject_id?: string | null;
  location?: string | null;
  notes?: string | null;
  priority?: ExamPriority;
  status?: ExamStatus;
  progress?: number;
};

export async function createExam(input: ExamInput): Promise<ExamRecord> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const row = {
    user_id: auth.user.id,
    title: input.title.trim(),
    exam_date: input.exam_date.slice(0, 10),
    subject_id: input.subject_id ?? null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    priority: input.priority ?? "medium",
    status: input.status ?? "planned",
    progress: input.progress ?? 0,
  };

  const { data, error } = await supabase.from("exams").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as ExamRecord;
}

export async function updateExam(id: string, input: Partial<ExamInput>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.exam_date !== undefined) patch.exam_date = input.exam_date.slice(0, 10);
  if (input.subject_id !== undefined) patch.subject_id = input.subject_id;
  if (input.location !== undefined) patch.location = input.location?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if (input.progress !== undefined) patch.progress = input.progress;

  const { error } = await supabase.from("exams").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from("exams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
