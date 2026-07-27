import type { ExamPlannerData } from "@/lib/exam-planner-data";
import { DEFAULT_PLANNER_DATA } from "@/lib/exam-planner-data";
import { supabase } from "@/integrations/supabase/client";

export async function fetchPlannerData(examId: string): Promise<ExamPlannerData> {
  const { data, error } = await supabase
    .from("exams")
    .select("planner_data")
    .eq("id", examId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.planner_data && typeof data.planner_data === "object") {
    return mergePlannerData(data.planner_data as Partial<ExamPlannerData>);
  }
  return DEFAULT_PLANNER_DATA();
}

export async function fetchAllPlannerData(): Promise<Record<string, ExamPlannerData>> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};

  const { data, error } = await supabase.from("exams").select("id, planner_data");
  if (error) throw new Error(error.message);

  const result: Record<string, ExamPlannerData> = {};
  for (const row of data ?? []) {
    if (row.planner_data && typeof row.planner_data === "object") {
      result[row.id] = mergePlannerData(row.planner_data as Partial<ExamPlannerData>);
    } else {
      result[row.id] = DEFAULT_PLANNER_DATA();
    }
  }
  return result;
}

export async function savePlannerData(examId: string, planner: ExamPlannerData): Promise<void> {
  const merged = mergePlannerData(planner);
  const { error } = await supabase
    .from("exams")
    .update({ planner_data: merged as never })
    .eq("id", examId);
  if (error) throw new Error(error.message);
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
