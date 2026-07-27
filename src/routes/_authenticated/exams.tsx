import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, GraduationCap, MapPin, Pencil, Plus, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamProgressBar, PriorityBadge, StatusBadge } from "@/components/exam-badges";
import { ExamPlannerPanel } from "@/components/ExamPlannerPanel";
import { ExamPlannerSummary } from "@/components/ExamPlannerSummary";
import { pageTitle } from "@/lib/brand";
import {
  EXAM_PRIORITIES, EXAM_STATUSES, countdownClass, countdownLabel,
  type ExamPriority, type ExamRecord, type ExamStatus,
} from "@/lib/exam-planner";
import {
  DEFAULT_PLANNER_DATA,
  progressFromTopics,
  type ExamPlannerData,
} from "@/lib/exam-planner-data";
import { fetchAllPlannerData, fetchPlannerData, savePlannerData } from "@/lib/exam-planner-storage";
import { createExam, deleteExam, fetchExams, updateExam } from "@/lib/exams-storage";
import { checkExamReminders, requestReminderPermission } from "@/lib/exam-reminders";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: pageTitle("Exams") }] }),
  component: ExamsPage,
});

const ALL = "__all__";

type ExamForm = {
  title: string;
  exam_date: string;
  subject_id: string;
  location: string;
  notes: string;
  priority: ExamPriority;
  status: ExamStatus;
  progress: number;
};

const emptyForm = (): ExamForm => ({
  title: "",
  exam_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  subject_id: ALL,
  location: "",
  notes: "",
  priority: "medium",
  status: "planned",
  progress: 0,
});

function ExamsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamRecord | null>(null);
  const [form, setForm] = useState<ExamForm>(emptyForm());
  const [planner, setPlanner] = useState<ExamPlannerData>(DEFAULT_PLANNER_DATA());
  const [loadingPlanner, setLoadingPlanner] = useState(false);

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: fetchExams,
  });

  const plannerQuery = useQuery({
    queryKey: ["exam-planner"],
    queryFn: fetchAllPlannerData,
  });

  const subjects = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name, color").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    const exams = examsQuery.data?.exams;
    const plannerMap = plannerQuery.data;
    if (!exams?.length || !plannerMap) return;
    checkExamReminders(exams, plannerMap);
    const id = window.setInterval(() => checkExamReminders(exams, plannerMap), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [examsQuery.data?.exams, plannerQuery.data]);

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const filtered = useMemo(() => {
    const list = examsQuery.data?.exams ?? [];
    return list.filter((exam) => {
      const hay = `${exam.title} ${exam.location ?? ""} ${exam.notes ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (statusFilter !== ALL && exam.status !== statusFilter) return false;
      if (priorityFilter !== ALL && exam.priority !== priorityFilter) return false;
      return true;
    });
  }, [examsQuery.data?.exams, q, statusFilter, priorityFilter]);

  async function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setPlanner(DEFAULT_PLANNER_DATA());
    await requestReminderPermission();
    setOpen(true);
  }

  async function openEdit(exam: ExamRecord) {
    setEditing(exam);
    setForm({
      title: exam.title,
      exam_date: exam.exam_date.slice(0, 10),
      subject_id: exam.subject_id ?? ALL,
      location: exam.location ?? "",
      notes: exam.notes ?? "",
      priority: exam.priority,
      status: exam.status,
      progress: exam.progress,
    });
    setLoadingPlanner(true);
    setOpen(true);
    try {
      const data = await fetchPlannerData(exam.id);
      setPlanner(data);
      if (data.topics.length > 0 && exam.progress === 0) {
        setForm((f) => ({ ...f, progress: progressFromTopics(data.topics) }));
      }
    } finally {
      setLoadingPlanner(false);
    }
  }

  function handlePlannerChange(next: ExamPlannerData, progress: number) {
    setPlanner(next);
    setForm((f) => ({
      ...f,
      progress,
      status:
        next.topics.some((t) => t.status === "doing" || t.status === "covered") && f.status === "planned"
          ? "studying"
          : f.status,
    }));
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Title is required");
    const payload = {
      title: form.title,
      exam_date: new Date(form.exam_date + "T09:00:00").toISOString(),
      subject_id: form.subject_id === ALL ? null : form.subject_id,
      location: form.location,
      notes: form.notes,
      priority: form.priority,
      status: form.status,
      progress: form.progress,
    };
    try {
      let examId = editing?.id;
      if (editing) {
        await updateExam(editing.id, payload);
        toast.success("Exam updated");
      } else {
        const created = await createExam(payload);
        examId = created.id;
        toast.success("Exam added");
      }
      if (examId) await savePlannerData(examId, planner);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exam-planner"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save exam");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this exam?")) return;
    try {
      await deleteExam(id);
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exam-planner"] });
      toast.success("Exam deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete exam");
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Exams</h1>
          <p className="text-muted-foreground mt-1">Scan syllabi, track topics, get AI study plans and reminders.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Add exam</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit exam" : "New exam"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Final — Organic Chemistry" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Exam date</Label><Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>No subject</SelectItem>
                      {(subjects.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room, hall, or online link" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ExamPriority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ExamStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Progress ({form.progress}%)</Label>
                <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full mt-2 accent-primary" />
                <p className="text-xs text-muted-foreground mt-1">Auto-updates when you mark topics — or set manually above.</p>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Extra reminders…" /></div>

              {loadingPlanner ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <ExamPlannerPanel
                  examTitle={form.title || "Exam"}
                  examDate={form.exam_date}
                  planner={planner}
                  onChange={handlePlannerChange}
                />
              )}

              <Button onClick={save} className="w-full">{editing ? "Save changes" : "Create exam"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input placeholder="Search exams…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {EXAM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {EXAM_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {examsQuery.isPending && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      )}

      {!examsQuery.isPending && filtered.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 text-primary" />
          No exams yet. Add your first exam to start planning.
        </Card>
      )}

      <div className="grid gap-4">
        {filtered.map((exam) => {
          const subject = exam.subject_id ? subjectMap.get(exam.subject_id) : null;
          const plannerData = plannerQuery.data?.[exam.id];
          return (
            <Card key={exam.id} className="p-5 group hover:border-primary/50 transition">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 min-w-0 space-y-3">
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
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", countdownClass(exam.exam_date))}>
                      {countdownLabel(exam.exam_date)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold">{exam.title}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{new Date(exam.exam_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                    {exam.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{exam.location}</span>}
                  </div>
                  {exam.notes && <p className="text-sm text-muted-foreground">{exam.notes}</p>}
                  <ExamProgressBar progress={exam.progress} />
                  {plannerData ? <ExamPlannerSummary planner={plannerData} /> : null}
                </div>
                <div className="flex lg:flex-col gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(exam)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(exam.id)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
