import { supabase } from "@/integrations/supabase/client";
import type { ExamPriority, ExamRecord, ExamStatus } from "@/lib/exam-planner";

const LOCAL_KEY = "examforge-exams";

function isMissingTableError(message: string) {
  return /exams|schema cache|relation|does not exist/i.test(message);
}

function readLocal(userId: string): ExamRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as ExamRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, exams: ExamRecord[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${LOCAL_KEY}:${userId}`, JSON.stringify(exams));
}

function newId() {
  return crypto.randomUUID();
}

export async function fetchExams(): Promise<{ exams: ExamRecord[]; localOnly: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { exams: [], localOnly: false };

  const { data, error } = await (supabase as any)
    .from("exams")
    .select("*")
    .order("exam_date", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message)) {
      return { exams: readLocal(auth.user.id), localOnly: true };
    }
    throw new Error(error.message);
  }

  return { exams: (data ?? []) as ExamRecord[], localOnly: false };
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
    exam_date: input.exam_date,
    subject_id: input.subject_id ?? null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    priority: input.priority ?? "medium",
    status: input.status ?? "planned",
    progress: input.progress ?? 0,
  };

  const { data, error } = await (supabase as any).from("exams").insert(row).select("*").single();
  if (!error && data) return data as ExamRecord;

  if (error && isMissingTableError(error.message)) {
    const now = new Date().toISOString();
    const exam: ExamRecord = {
      id: newId(),
      user_id: auth.user.id,
      subject_id: row.subject_id,
      title: row.title,
      exam_date: row.exam_date,
      location: row.location,
      notes: row.notes,
      priority: row.priority as ExamPriority,
      status: row.status as ExamStatus,
      progress: row.progress,
      created_at: now,
      updated_at: now,
    };
    const exams = readLocal(auth.user.id);
    exams.push(exam);
    writeLocal(auth.user.id, exams);
    return exam;
  }

  throw new Error(error?.message ?? "Failed to create exam");
}

export async function updateExam(id: string, input: Partial<ExamInput>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const patch: Partial<ExamInput> = { ...input };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.location !== undefined) patch.location = input.location?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const { error } = await (supabase as any).from("exams").update({
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.exam_date !== undefined ? { exam_date: patch.exam_date } : {}),
    ...(patch.subject_id !== undefined ? { subject_id: patch.subject_id } : {}),
    ...(patch.location !== undefined ? { location: patch.location } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
  }).eq("id", id);
  if (!error) return;

  if (error && isMissingTableError(error.message)) {
    const exams = readLocal(auth.user.id);
    const idx = exams.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Exam not found");
    exams[idx] = {
      ...exams[idx],
      ...patch,
      title: (patch.title as string | undefined) ?? exams[idx].title,
      updated_at: new Date().toISOString(),
    } as ExamRecord;
    writeLocal(auth.user.id, exams);
    return;
  }

  throw new Error(error.message);
}

export async function deleteExam(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { error } = await (supabase as any).from("exams").delete().eq("id", id);
  if (!error) return;

  if (error && isMissingTableError(error.message)) {
    writeLocal(auth.user.id, readLocal(auth.user.id).filter((e) => e.id !== id));
    return;
  }

  throw new Error(error.message);
}
