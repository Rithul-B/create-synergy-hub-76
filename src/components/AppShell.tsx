import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { useState, type ReactNode } from "react";

import {
  MessageSquare,
  BookOpen,
  Presentation,
  Video,
  AudioLines,
  LayoutDashboard,
  Library,
  Settings,
  LogOut,
  GraduationCap,
  Book,
  MoreHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { useQueryClient } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/brand";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },

  { to: "/exams", label: "Exams", icon: GraduationCap },

  { to: "/subjects", label: "Subjects", icon: BookOpen },

  { to: "/chat", label: "AI Tutor", icon: MessageSquare },

  { to: "/library", label: "Library", icon: Library },

  { to: "/powerpoint", label: "Slides", icon: Presentation },

  { to: "/audio", label: "Audio", icon: AudioLines },

  { to: "/video", label: "Video", icon: Video },

  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_PRIMARY = ["/dashboard", "/exams", "/subjects", "/chat"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  const navigate = useNavigate();

  const qc = useQueryClient();

  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(to + "/");
  }

  async function signOut() {
    await qc.cancelQueries();

    qc.clear();

    await supabase.auth.signOut();

    navigate({ to: "/auth", replace: true });
  }

  const primary = NAV.filter((item) => (MOBILE_PRIMARY as readonly string[]).includes(item.to));

  const secondary = NAV.filter((item) => !(MOBILE_PRIMARY as readonly string[]).includes(item.to));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Book className="h-4 w-4" />
            </div>

            <span className="font-display text-xl">{APP_NAME}</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}

                to={item.to}

                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",

                  isActive(item.to)
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
                )}
              >
                <NavIcon icon={Icon} to={item.to} active={isActive(item.to)} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}

          className="m-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 py-3 md:px-6">
          <Link to="/dashboard" className="md:hidden flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Book className="h-4 w-4" />
            </div>

            <span className="font-display text-lg truncate">{APP_NAME}</span>
          </Link>

          <div className="hidden md:block flex-1" />

          <ThemeToggle />
        </header>

        <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border flex justify-around py-2">
        {primary.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.to}

              to={item.to}

              className={cn(
                "flex flex-col items-center text-[10px] px-2 py-1",

                isActive(item.to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <NavIcon icon={Icon} to={item.to} active={isActive(item.to)} size="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger className="flex flex-col items-center text-[10px] px-2 py-1 text-muted-foreground">
            <MoreHorizontal className="h-5 w-5 mb-0.5" />
            More
          </SheetTrigger>

          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2 px-4">
              {secondary.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}

                    to={item.to}

                    onClick={() => setMoreOpen(false)}

                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-3 text-sm",

                      isActive(item.to)
                        ? "border-primary text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />

                    {item.label}
                  </Link>
                );
              })}
            </div>

            <button
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}

              className="mt-3 mx-4 flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm text-destructive w-[calc(100%-2rem)]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
