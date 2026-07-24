import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Sparkles, MessageSquare, BookOpen, Presentation, Video, AudioLines, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnLab — AI learning & content platform" },
      { name: "description", content: "Chat with AI tutors, organize subjects, and instantly generate presentations, narrated audio, and video from your ideas." },
      { property: "og:title", content: "LearnLab — AI learning & content platform" },
      { property: "og:description", content: "Chat with AI tutors, organize subjects, and instantly generate presentations, narrated audio, and video from your ideas." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const features = [
    { icon: MessageSquare, title: "AI Chat", desc: "Ask anything, get clear answers with full history." },
    { icon: BookOpen, title: "Subjects", desc: "Organize learning by topic with focused workspaces." },
    { icon: Presentation, title: "PowerPoint", desc: "Turn ideas into downloadable .pptx decks." },
    { icon: AudioLines, title: "Audio", desc: "Convert text into natural narration." },
    { icon: Video, title: "Video", desc: "Script and plan short educational videos." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <header className="max-w-6xl mx-auto flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl">LearnLab</span>
        </div>
        <Link to={authed ? "/dashboard" : "/auth"} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90">
          {authed ? "Open app" : "Sign in"}
        </Link>
      </header>
      <section className="max-w-4xl mx-auto text-center px-6 py-16 md:py-24">
        <h1 className="font-display text-5xl md:text-7xl leading-tight">
          Learn, create,<br />and share — with AI.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          One workspace to chat with AI tutors, manage your subjects, and instantly generate presentations, narrated audio, and short videos.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to={authed ? "/dashboard" : "/auth"} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <section className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-5 gap-4 px-6 pb-20">
        {features.map((f) => (
          <div key={f.title} className="p-5 rounded-xl bg-card border">
            <f.icon className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
