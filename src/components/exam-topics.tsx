import { cn } from "@/lib/utils";
import {
  topicStatusMeta,
  type ExamTopic,
  type TopicStatus,
  TOPIC_STATUSES,
} from "@/lib/exam-planner-data";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export function TopicBadge({ topic }: { topic: ExamTopic }) {
  const meta = topicStatusMeta(topic.status);
  const Icon =
    topic.status === "covered" ? CheckCircle2 : topic.status === "doing" ? Loader2 : Circle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        meta.className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", meta.iconColor, topic.status === "doing" && "animate-spin")} />
      {topic.name}
    </span>
  );
}

export function TopicStatusPicker({
  status,
  onChange,
  compact,
}: {
  status: TopicStatus;
  onChange: (s: TopicStatus) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", compact && "gap-0.5")}>
      {TOPIC_STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
            status === s.value ? s.className : "border-transparent text-muted-foreground hover:bg-muted",
          )}
        >
          {compact ? s.label.split(" ")[0] : s.label}
        </button>
      ))}
    </div>
  );
}

export function TopicSummary({ topics }: { topics: ExamTopic[] }) {
  const covered = topics.filter((t) => t.status === "covered").length;
  const doing = topics.filter((t) => t.status === "doing").length;
  const notCovered = topics.filter((t) => t.status === "not_covered").length;
  if (topics.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{covered} covered</span>
      <span className="text-amber-600 dark:text-amber-400 font-medium">{doing} in progress</span>
      <span className="text-rose-600 dark:text-rose-400 font-medium">{notCovered} not covered</span>
    </div>
  );
}
