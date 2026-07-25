import { cn } from "@/lib/utils";
import {
  priorityMeta,
  progressBarColor,
  statusMeta,
  type ExamPriority,
  type ExamStatus,
} from "@/lib/exam-planner";

export function PriorityBadge({ priority, className }: { priority: ExamPriority; className?: string }) {
  const meta = priorityMeta(priority);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className, className)}>
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: ExamStatus; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className, className)}>
      {meta.label}
    </span>
  );
}

export function ExamProgressBar({ progress, className }: { progress: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>Study progress</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", progressBarColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
