import type { ExamPlannerData } from "@/lib/exam-planner-data";
import { DEFAULT_PLANNER_DATA } from "@/lib/exam-planner-data";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "examforge-planner";

function localKey(userId: string) {
  return `${LOCAL_KEY}:${userId}`;
}

function readLocalAll(userId: string): Record<string, ExamPlannerData> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, ExamPlannerData>) : {};
  } catch {
    return {};
  }
}

function writeLocalAll(userId: string, data: Record<string, ExamPlannerData>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(localKey(userId), JSON.stringify(data));
}

function isMissingColumn(message: string) {
  return /planner_data|schema cache|column|does not exist/i.test(message);
}

export async function fetchPlannerData(examId: string): Promise<ExamPlannerData> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEFAULT_PLANNER_DATA();

  const { data, error } = await supabase
    .from("exams")
    .select("planner_data")
    .eq("id", examId)
    .maybeSingle();

  if (!error && data?.planner_data && typeof data.planner_data === "object") {
    return mergePlannerData(data.planner_data as Partial<ExamPlannerData>);
  }

  if (error && !isMissingColumn(error.message)) {
    // Table might exist without column — fall through to local
  }

  const local = readLocalAll(auth.user.id)[examId];
  return local ? mergePlannerData(local) : DEFAULT_PLANNER_DATA();
}

export async function fetchAllPlannerData(): Promise<Record<string, ExamPlannerData>> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};

  const { data, error } = await supabase.from("exams").select("id, planner_data");
  const result: Record<string, ExamPlannerData> = { ...readLocalAll(auth.user.id) };

  if (!error && data) {
    for (const row of data) {
      if (row.planner_data && typeof row.planner_data === "object") {
        result[row.id] = mergePlannerData(row.planner_data as Partial<ExamPlannerData>);
      }
    }
  } else if (error && isMissingColumn(error.message)) {
    return result;
  } else if (error) {
    throw new Error(error.message);
  }

  return result;
}

export async function savePlannerData(examId: string, planner: ExamPlannerData): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const merged = mergePlannerData(planner);

  const { error } = await supabase
    .from("exams")
    .update({ planner_data: merged })
    .eq("id", examId);

  if (!error) return;

  if (isMissingColumn(error.message)) {
    const all = readLocalAll(auth.user.id);
    all[examId] = merged;
    writeLocalAll(auth.user.id, all);
    return;
  }

  throw new Error(error.message);
}

function mergePlannerData(partial: Partial<ExamPlannerData>): ExamPlannerData {
  const base = DEFAULT_PLANNER_DATA();
  return {
    topics: partial.topics ?? base.topics,
    syllabus_text: partial.syllabus_text ?? base.syllabus_text,
    study_plan: partial.study_plan ?? base.study_plan,
    reminders: { ...base.reminders, ...partial.reminders },
  };
}
