export type TopicStatus = "not_covered" | "doing" | "covered";

export type ExamTopic = {
  id: string;
  name: string;
  status: TopicStatus;
};

export type StudyPlanDay = {
  date: string;
  label: string;
  topics: string[];
  notes?: string;
};

export type ExamReminders = {
  enabled: boolean;
  /** Days before exam to notify (e.g. 7, 3, 1, 0 = day-of) */
  days_before: number[];
};

export type ExamPlannerData = {
  topics: ExamTopic[];
  syllabus_text: string;
  study_plan: StudyPlanDay[];
  reminders: ExamReminders;
};

export const DEFAULT_REMINDERS: ExamReminders = {
  enabled: true,
  days_before: [7, 3, 1, 0],
};

export const DEFAULT_PLANNER_DATA = (): ExamPlannerData => ({
  topics: [],
  syllabus_text: "",
  study_plan: [],
  reminders: { ...DEFAULT_REMINDERS },
});

export const TOPIC_STATUSES: Array<{
  value: TopicStatus;
  label: string;
  className: string;
  iconColor: string;
}> = [
  {
    value: "not_covered",
    label: "Not covered",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    iconColor: "text-rose-500",
  },
  {
    value: "doing",
    label: "In progress",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    iconColor: "text-amber-500",
  },
  {
    value: "covered",
    label: "Covered",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    iconColor: "text-emerald-500",
  },
];

export function topicStatusMeta(status: TopicStatus) {
  return TOPIC_STATUSES.find((s) => s.value === status) ?? TOPIC_STATUSES[0];
}

/** Progress from topic statuses: covered=100%, doing=50%, not_covered=0% */
export function progressFromTopics(topics: ExamTopic[]): number {
  if (topics.length === 0) return 0;
  const score = topics.reduce((sum, t) => {
    if (t.status === "covered") return sum + 100;
    if (t.status === "doing") return sum + 50;
    return sum;
  }, 0);
  return Math.round(score / topics.length);
}

export function topicsByStatus(topics: ExamTopic[]) {
  return {
    covered: topics.filter((t) => t.status === "covered"),
    doing: topics.filter((t) => t.status === "doing"),
    not_covered: topics.filter((t) => t.status === "not_covered"),
  };
}

export function newTopicId() {
  return crypto.randomUUID();
}

export function topicsFromNames(names: string[]): ExamTopic[] {
  return names.filter(Boolean).map((name) => ({
    id: newTopicId(),
    name: name.trim(),
    status: "not_covered" as TopicStatus,
  }));
}
