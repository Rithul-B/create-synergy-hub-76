import { createFileRoute, Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

import { useEffect, useState } from "react";

import {
  GraduationCap,
  CalendarDays,
  BookOpen,
  Book,
  MessageSquare,
  Target,
  ArrowRight,
  Presentation,
  AudioLines,
  Video,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — ${APP_TAGLINE}` },

      { name: "description", content: APP_DESCRIPTION },

      { property: "og:title", content: `${APP_NAME} — ${APP_TAGLINE}` },

      { property: "og:description", content: APP_DESCRIPTION },

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
    {
      icon: GraduationCap,
      title: "Exam planner",
      desc: "Schedule exams with dates, locations, priorities, and countdowns.",
    },

    {
      icon: Target,
      title: "Study progress",
      desc: "Track readiness with status tags and progress bars for every exam.",
    },

    {
      icon: CalendarDays,
      title: "Smart countdowns",
      desc: "Color-coded urgency so you always know what's due next.",
    },

    {
      icon: BookOpen,
      title: "Subjects",
      desc: "Organize courses by topic with vibrant color-coded workspaces.",
    },

    {
      icon: MessageSquare,
      title: "AI Tutor",
      desc: "Ask questions, review concepts, and get help when you're stuck.",
    },

    {
      icon: Presentation,
      title: "Slides & media",
      desc: "Generate slides, audio, and video to reinforce your revision.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <header className="max-w-6xl mx-auto flex items-center justify-between p-6 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <GraduationCap className="h-5 w-5" />
          </div>

          <span className="font-display text-2xl truncate">{APP_NAME}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          <Link
            to={authed ? "/dashboard" : "/auth"}
            className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            {authed ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto text-center px-6 py-16 md:py-24">
        <h1 className="font-display text-5xl md:text-7xl leading-tight">
          Plan, track,
          <br />
          and ace every exam.
        </h1>

        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">{APP_DESCRIPTION}</p>

        <div className="mt-8 flex justify-center gap-3 flex-wrap">
          <Link
            to={authed ? "/dashboard" : "/auth"}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to={authed ? "/exams" : "/auth"}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border font-medium hover:bg-accent"
          >
            <CalendarDays className="h-4 w-4" /> View exams
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pb-12">
        {features.map((f) => (
          <div key={f.title} className="p-5 rounded-xl bg-card border">
            <f.icon className="h-6 w-6 text-primary mb-3" />

            <h3 className="font-semibold">{f.title}</h3>

            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <div className="rounded-2xl border bg-card p-8 md:p-10">
          <AudioLines className="h-8 w-8 text-primary mx-auto mb-4" />

          <h2 className="font-display text-3xl">Everything you need to prepare</h2>

          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            From exam scheduling and progress tracking to AI tutoring and revision content — one
            workspace for your entire study plan.
          </p>

          <Link
            to={authed ? "/dashboard" : "/auth"}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            Start planning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
