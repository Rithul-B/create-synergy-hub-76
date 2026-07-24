import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  MessageSquare,
  BookOpen,
  Presentation,
  Video,
  AudioLines,
  LayoutDashboard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/powerpoint", label: "PowerPoint", icon: Presentation },
  { to: "/audio", label: "Audio", icon: AudioLines },
  { to: "/video", label: "Video", icon: Video },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display text-xl">LearnLab</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
                )}
              >
                <Icon className="h-4 w-4" />
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
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border flex justify-around py-2">
        {NAV.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={cn("flex flex-col items-center text-[10px] px-2 py-1", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-5 w-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
