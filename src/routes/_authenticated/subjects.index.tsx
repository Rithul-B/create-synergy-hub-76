import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Pin, PinOff, Pencil, Trash2, Search } from "lucide-react";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/subjects/")({
  head: () => ({ meta: [{ title: pageTitle("Subjects") }] }),
  component: SubjectsPage,
});

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6"];

function SubjectsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const subjects = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*, threads(count)").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function save() {
    if (!name.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    if (editingId) {
      const { error } = await supabase.from("subjects").update({ name, description, color }).eq("id", editingId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("subjects").insert({ user_id: user.user.id, name, description, color });
      if (error) return toast.error(error.message);
    }
    setName(""); setDescription(""); setColor(COLORS[0]); setEditingId(null); setOpen(false);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("subjects").update({ pinned: !pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this subject? Chats will be unassigned.")) return;
    await supabase.from("subjects").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  const filtered = (subjects.data ?? []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Subjects</h1>
          <p className="text-muted-foreground">Organize your learning by topic.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setName(""); setDescription(""); }}}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New subject</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit subject" : "New subject"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" /></div>
              <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={save} className="w-full">{editingId ? "Save" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input placeholder="Search subjects…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2" />
          No subjects yet. Create one to get started.
        </Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => {
          const count = (s as unknown as { threads?: Array<{ count: number }> }).threads?.[0]?.count ?? 0;
          return (
            <Card key={s.id} className="p-5 group hover:border-primary transition">
              <div className="flex items-start justify-between">
                <Link to="/subjects/$subjectId" params={{ subjectId: s.id }} className="flex-1">
                  <div className="h-10 w-10 rounded-lg grid place-items-center text-white" style={{ backgroundColor: s.color }}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="mt-3 font-semibold">{s.name}</div>
                  {s.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</div>}
                  <div className="text-xs text-muted-foreground mt-2">{count} chat{count === 1 ? "" : "s"}</div>
                </Link>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => togglePin(s.id, s.pinned)} className="text-muted-foreground hover:text-foreground">{s.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
                  <button onClick={() => { setEditingId(s.id); setName(s.name); setDescription(s.description ?? ""); setColor(s.color); setOpen(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
