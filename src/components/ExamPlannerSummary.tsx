import { useState } from "react";
import { Bell, BellOff, CalendarClock, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicSummary } from "@/components/exam-topics";
import { topicStatusMeta, type ExamPlannerData } from "@/lib/exam-planner-data";
import { cn } from "@/lib/utils";

export function ExamPlannerSummary({ planner }: { planner: ExamPlannerData }) {
  const [open, setOpen] = useState(false);

  const hasTopics = planner.topics.length > 0;
  const hasPlan = planner.study_plan.length > 0;
  const hasSyllabus = planner.syllabus_text.trim().length > 0;
  if (!hasTopics && !hasPlan && !hasSyllabus) return null;

  const upcoming = planner.study_plan.slice(0, open ? planner.study_plan.length : 3);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          Study planner
        </span>
        {hasSyllabus && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            <FileText className="h-3 w-3" /> Syllabus saved
          </span>
        )}
        {hasPlan && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            <CalendarClock className="h-3 w-3" /> {planner.study_plan.length}-day plan
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
          {planner.reminders.enabled ? (
            <>
              <Bell className="h-3 w-3" /> Reminders{" "}
              {planner.reminders.days_before
                .slice()
                .sort((a, b) => b - a)
                .map((d) => (d === 0 ? "day of" : `${d}d`))
                .join(" · ")}
            </>
          ) : (
            <>
              <BellOff className="h-3 w-3" /> Reminders off
            </>
          )}
        </span>
      </div>

      {hasTopics && <TopicSummary topics={planner.topics} />}

      {hasTopics && open && (
        <div className="flex flex-wrap gap-1.5">
          {planner.topics.map((t) => {
            const meta = topicStatusMeta(t.status);
            return (
              <span
                key={t.id}
                className={cn("rounded-full border px-2 py-0.5 text-xs", meta.className)}
              >
                {t.name}
              </span>
            );
          })}
        </div>
      )}

      {hasPlan && (
        <ul className="space-y-1.5">
          {upcoming.map((day, i) => (
            <li key={`${day.date}-${i}`} className="flex gap-2 text-xs">
              <span className="w-24 shrink-0 font-medium text-foreground">{day.label}</span>
              <span className="text-muted-foreground">
                {day.topics.join(", ") || day.notes || "Review"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(planner.study_plan.length > 3 || hasTopics) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 mr-1 transition", open && "rotate-180")} />
          {open ? "Show less" : "Show full plan"}
        </Button>
      )}
    </div>
  );
}
