import { createFileRoute, Link } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { useMemo } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";

import { ExamProgressBar, PriorityBadge, StatusBadge } from "@/components/exam-badges";

import { pageTitle } from "@/lib/brand";

import { countdownClass, countdownLabel, daysUntil } from "@/lib/exam-planner";

import { fetchExams } from "@/lib/exams-storage";

import {
  GraduationCap,
  Book,
  CalendarDays,
  ArrowRight,
  Flame,
  Plus,
  BookOpen,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: pageTitle("Overview") }] }),

  component: Dashboard,
});

const ACTIVITY_DAYS = 14;

function localDayKey(iso: string) {
  const d = new Date(iso);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Dashboard() {
  const examsQuery = useQuery({
    queryKey: ["exams"],

    queryFn: fetchExams,
  });

  const subjects = useQuery({
    queryKey: ["subjects"],

    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name, color").order("name");

      return data ?? [];
    },
  });

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),

    [subjects.data],
  );

  const examStats = useMemo(() => {
    const list = examsQuery.data?.exams ?? [];

    const active = list.filter((e) => e.status !== "done");

    const upcoming7 = active.filter((e) => {
      const days = daysUntil(e.exam_date);

      return days >= 0 && days <= 7;
    }).length;

    const avgProgress = active.length
      ? Math.round(active.reduce((sum, e) => sum + e.progress, 0) / active.length)
      : 0;

    const studying = active.filter((e) => e.status === "studying" || e.status === "review").length;

    return { total: list.length, active: active.length, upcoming7, avgProgress, studying };
  }, [examsQuery.data]);

  const upcoming = useMemo(() => {
    const list = examsQuery.data?.exams ?? [];

    return list

      .filter((e) => e.status !== "done" && daysUntil(e.exam_date) >= 0)

      .sort((a, b) => daysUntil(a.exam_date) - daysUntil(b.exam_date))

      .slice(0, 5);
  }, [examsQuery.data]);

  const activity = useQuery({
    queryKey: ["activity", ACTIVITY_DAYS],

    queryFn: async () => {
      const since = new Date();

      since.setHours(0, 0, 0, 0);

      since.setDate(since.getDate() - (ACTIVITY_DAYS - 1));

      const [messages, content] = await Promise.all([
        supabase
          .from("messages")
          .select("created_at")
          .eq("role", "user")
          .gte("created_at", since.toISOString()),

        supabase
          .from("generated_content")
          .select("created_at")
          .gte("created_at", since.toISOString()),
      ]);

      const days: Array<{ key: string; label: string; questions: number; created: number }> = [];

      for (let i = 0; i < ACTIVITY_DAYS; i++) {
        const d = new Date(since);

        d.setDate(since.getDate() + i);

        days.push({
          key: localDayKey(d.toISOString()),

          label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),

          questions: 0,

          created: 0,
        });
      }

      const byKey = new Map(days.map((d) => [d.key, d]));

      for (const m of messages.data ?? []) {
        const day = byKey.get(localDayKey(m.created_at));

        if (day) day.questions += 1;
      }

      for (const c of content.data ?? []) {
        const day = byKey.get(localDayKey(c.created_at));

        if (day) day.created += 1;
      }

      let streak = 0;

      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].questions + days[i].created > 0) streak++;
        else break;
      }

      return {
        days,

        streak,

        totalQuestions: days.reduce((sum, d) => sum + d.questions, 0),

        totalCreated: days.reduce((sum, d) => sum + d.created, 0),
      };
    },
  });

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Exam overview</h1>

          <p className="text-muted-foreground mt-1">
            Track upcoming exams, study progress, and stay on schedule.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(activity.data?.streak ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-orange-500/10 text-orange-600 px-4 py-2 text-sm font-medium">
              <Flame className="h-4 w-4" />
              {activity.data!.streak}-day streak
            </div>
          )}

          <Button asChild>
            <Link to="/exams">
              <Plus className="h-4 w-4 mr-1.5" /> Add exam
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {examsQuery.isPending ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] w-full" />)
        ) : (
          <>
            <Stat
              label="Total exams"
              value={examStats.total}
              icon={Book}
              color="text-violet-600"
            />

            <Stat
              label="Due this week"
              value={examStats.upcoming7}
              icon={CalendarDays}
              color="text-rose-600"
            />

            <Stat
              label="Avg. progress"
              value={examStats.avgProgress}
              suffix="%"
              icon={Target}
              color="text-blue-600"
            />

            <Stat
              label="In study/review"
              value={examStats.studying}
              icon={BookOpen}
              color="text-emerald-600"
            />
          </>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold">Upcoming exams</h2>

          <Link
            to="/exams"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {examsQuery.isPending && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        )}

        {!examsQuery.isPending && upcoming.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 text-primary" />

            <p>No upcoming exams scheduled.</p>

            <Button asChild className="mt-4" variant="outline">
              <Link to="/exams">
                <Plus className="h-4 w-4 mr-1.5" /> Plan your first exam
              </Link>
            </Button>
          </Card>
        )}

        <div className="space-y-3">
          {upcoming.map((exam) => {
            const subject = exam.subject_id ? subjectMap.get(exam.subject_id) : null;

            return (
              <Card key={exam.id} className="p-5 hover:border-primary/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {subject && (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"

                          style={{ backgroundColor: subject.color }}
                        >
                          {subject.name}
                        </span>
                      )}

                      <PriorityBadge priority={exam.priority} />

                      <StatusBadge status={exam.status} />

                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          countdownClass(exam.exam_date),
                        )}
                      >
                        {countdownLabel(exam.exam_date)}
                      </span>
                    </div>

                    <h3 className="font-semibold text-lg">{exam.title}</h3>

                    <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />

                      {new Date(exam.exam_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>

                    <ExamProgressBar progress={exam.progress} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold">Study activity</h2>

            <p className="text-sm text-muted-foreground">
              {activity.data
                ? `${activity.data.totalQuestions} question${activity.data.totalQuestions === 1 ? "" : "s"} asked · ${activity.data.totalCreated} item${activity.data.totalCreated === 1 ? "" : "s"} created`
                : "Loading your activity…"}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Questions
            </span>

            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-pink-500" /> Created
            </span>
          </div>
        </div>

        <div className="h-48 mt-4">
          {activity.isPending ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activity.data?.days ?? []}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="questionsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />

                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>

                  <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.3} />

                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  opacity={0.12}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  stroke="currentColor"
                  opacity={0.5}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                />

                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid rgba(120,120,140,0.3)",
                  }}

                  labelStyle={{ fontWeight: 600 }}
                />

                <Area
                  type="monotone"
                  dataKey="questions"
                  name="Questions"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#questionsFill)"
                />

                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fill="url(#createdFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,

  value,

  suffix = "",

  icon: Icon,

  color,
}: {
  label: string;

  value: number;

  suffix?: string;

  icon: typeof GraduationCap;

  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-semibold">
          {value}
          {suffix}
        </div>

        <Icon className={cn("h-5 w-5 opacity-70", color)} />
      </div>

      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{label}</div>
    </Card>
  );
}
