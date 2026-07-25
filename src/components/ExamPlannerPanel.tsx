import { useRef, useState } from "react";
import { Camera, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { scanSyllabusImage, searchSyllabusText, generateStudyPlan } from "@/lib/exam.functions";
import {
  topicsFromNames,
  type ExamPlannerData,
  type ExamTopic,
  progressFromTopics,
} from "@/lib/exam-planner-data";
import { parseTopicsFromText } from "@/lib/offline-ai";
import { TopicStatusPicker, TopicSummary } from "@/components/exam-topics";
import { ExamProgressBar } from "@/components/exam-badges";

type Props = {
  examTitle: string;
  examDate: string;
  planner: ExamPlannerData;
  onChange: (planner: ExamPlannerData, progress: number) => void;
};

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function ExamPlannerPanel({ examTitle, examDate, planner, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResult, setSearchResult] = useState("");

  function updateTopics(topics: ExamTopic[]) {
    const progress = progressFromTopics(topics);
    onChange({ ...planner, topics }, progress);
  }

  async function handleScan(file: File) {
    setScanning(true);
    try {
      const imageDataUrl = await readImage(file);
      const result = await scanSyllabusImage({ data: { imageDataUrl } });
      const newTopics = topicsFromNames(result.topics);
      const merged = [...planner.topics];
      for (const t of newTopics) {
        if (!merged.some((m) => m.name.toLowerCase() === t.name.toLowerCase())) merged.push(t);
      }
      onChange(
        { ...planner, topics: merged, syllabus_text: result.syllabus_summary || planner.syllabus_text },
        progressFromTopics(merged),
      );
      toast.success(`Found ${result.topics.length} topics from syllabus`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Syllabus scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function autoPlan() {
    if (planner.topics.length === 0) return toast.error("Add topics first — scan a syllabus or type them in");
    setPlanning(true);
    try {
      const result = await generateStudyPlan({
        data: {
          examTitle,
          examDate,
          topics: planner.topics.map((t) => t.name),
          syllabusText: planner.syllabus_text,
        },
      });
      onChange({ ...planner, study_plan: result.plan }, progressFromTopics(planner.topics));
      toast.success("Study plan generated!");
      if (result.tips.length) toast.info(result.tips[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate plan");
    } finally {
      setPlanning(false);
    }
  }

  async function searchSyllabus() {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const result = await searchSyllabusText({
        data: { query: searchQ, syllabusText: planner.syllabus_text },
      });
      setSearchResult(result.answer);
      if (result.matches.length) {
        const merged = [...planner.topics];
        for (const name of result.matches) {
          if (!merged.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
            merged.push(...topicsFromNames([name]));
          }
        }
        updateTopics(merged);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function addTopic(name: string) {
    if (!name.trim()) return;
    updateTopics([...planner.topics, ...topicsFromNames([name.trim()])]);
  }

  return (
    <div className="space-y-4 border-t pt-4 mt-2">
      <div>
        <Label className="text-base font-semibold">Syllabus scanner</Label>
        <p className="text-xs text-muted-foreground mt-0.5">Upload a photo of your syllabus — AI extracts topics automatically.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleScan(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" disabled={scanning} onClick={() => fileRef.current?.click()}>
            {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload image
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={scanning} onClick={() => {
            if (fileRef.current) {
              fileRef.current.removeAttribute("capture");
              fileRef.current.click();
            }
          }}>
            <Camera className="h-4 w-4 mr-1" /> Take photo
          </Button>
        </div>
      </div>

      <div>
        <Label>Syllabus notes (editable)</Label>
        <Textarea
          value={planner.syllabus_text}
          onChange={(e) => {
            const text = e.target.value;
            const parsed = parseTopicsFromText(text);
            const merged = [...planner.topics];
            for (const name of parsed) {
              if (!merged.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
                merged.push(...topicsFromNames([name]));
              }
            }
            const next = { ...planner, syllabus_text: text, topics: merged };
            onChange(next, progressFromTopics(merged));
          }}
          placeholder="Pasted syllabus text or AI summary…"
          rows={3}
          className="mt-1"
        />
        <div className="flex gap-2 mt-2">
          <Input placeholder="Search syllabus…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          <Button type="button" variant="secondary" size="sm" disabled={searching} onClick={searchSyllabus}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {searchResult && <p className="text-sm text-muted-foreground mt-2">{searchResult}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base font-semibold">Topics</Label>
          <TopicSummary topics={planner.topics} />
        </div>
        <ExamProgressBar progress={progressFromTopics(planner.topics)} className="mt-2" />
        <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
          {planner.topics.map((topic) => (
            <div key={topic.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
              <span className="text-sm truncate flex-1">{topic.name}</span>
              <TopicStatusPicker
                status={topic.status}
                compact
                onChange={(status) =>
                  updateTopics(planner.topics.map((t) => (t.id === topic.id ? { ...t, status } : t)))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Add topic manually…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTopic((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={autoPlan} disabled={planning}>
          {planning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          AI plan everything for me
        </Button>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={planner.reminders.enabled}
            onChange={(e) =>
              onChange(
                { ...planner, reminders: { ...planner.reminders, enabled: e.target.checked } },
                progressFromTopics(planner.topics),
              )
            }
          />
          Exam reminders (7, 3, 1 days + day-of)
        </label>
      </div>

      {planner.study_plan.length > 0 && (
        <div>
          <Label className="text-base font-semibold">Your study plan</Label>
          <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
            {planner.study_plan.map((day, i) => (
              <div key={i} className="rounded-md border p-2 text-sm">
                <div className="font-medium text-primary">{day.label}</div>
                <div className="text-xs text-muted-foreground">{day.date}</div>
                <div className="mt-1">{day.topics.join(" · ")}</div>
                {day.notes && <div className="text-xs text-muted-foreground mt-0.5">{day.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
