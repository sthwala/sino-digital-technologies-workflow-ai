import { Link } from "@tanstack/react-router";
import {
  BrainCircuit,
  CheckSquare,
  LayoutDashboard,
  Menu,
  NotebookPen,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";

import { getAiMode } from "@/lib/ai.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/meetings", label: "Meeting Notes", icon: NotebookPen },
  { to: "/tasks", label: "Task Planner", icon: CheckSquare },
  { to: "/research", label: "Research", icon: BrainCircuit },
  { to: "/about", label: "Responsible AI", icon: ShieldCheck },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-foreground/75 transition-colors hover:bg-white/10 hover:text-navy-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          activeProps={{ className: "bg-white/15 text-navy-foreground" }}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const aiMode = useServerFn(getAiMode);
  const { data } = useQuery({
    queryKey: ["ai-mode"],
    queryFn: () => aiMode({}),
    staleTime: Infinity,
  });
  const live = data?.live ?? false;

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-navy text-navy-foreground shadow-[var(--shadow-elevated)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2" aria-label="WorkFlow AI home">
            <span className="grid size-9 place-items-center rounded-lg bg-cyan text-cyan-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold">WorkFlow AI</span>
              <span className="block text-[11px] text-navy-foreground/70">
                Turn information into action.
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            <NavLinks />
          </nav>

          <Badge
            className={`ml-auto md:ml-2 ${live ? "bg-success text-white" : "bg-cyan text-cyan-foreground"}`}
          >
            {live ? "Live AI" : "Demo mode"}
          </Badge>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-navy-foreground hover:bg-white/10 md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-none bg-navy text-navy-foreground">
              <SheetHeader>
                <SheetTitle className="text-navy-foreground">Navigation</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="mt-2 flex flex-col gap-1 px-2">
                <NavLinks onNavigate={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          <p>
            {live ? (
              <>
                WorkFlow AI is connected to a server-side AI provider (keys never reach your
                browser). Prioritization and scheduling always run on-device. Always review AI
                output before acting on it.
              </>
            ) : (
              <>
                WorkFlow AI runs in <strong>demo mode</strong>: results come from an on-device
                heuristic engine unless an AI provider is configured server-side. Always review AI
                output before acting on it.
              </>
            )}
          </p>
          <p className="mt-2">
            <Link to="/about" className="font-medium text-primary underline underline-offset-4">
              Read the responsible-AI notice
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
