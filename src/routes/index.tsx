import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buildSchedule, mockResearch, mockSummarizeMeeting, prioritizeTasks } from "@/lib/mock-ai";
import { SAMPLE_ARTICLE, SAMPLE_TRANSCRIPT } from "@/lib/samples";
import { uid, useActions, useAppData } from "@/lib/store";
import type { MeetingSummary, ResearchBrief, Task } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — WorkFlow AI" },
      {
        name: "description",
        content:
          "Your WorkFlow AI dashboard: today's AI-prioritized focus, meeting summaries, research briefs and task progress in one place.",
      },
      { property: "og:title", content: "Dashboard — WorkFlow AI" },
      {
        property: "og:description",
        content: "Today's AI-prioritized focus, meeting summaries and research briefs.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { tasks, meetings, briefs } = useAppData();
  const actions = useActions();

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.length - open.length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const focus = useMemo(() => prioritizeTasks(tasks).slice(0, 3), [tasks]);
  const today = useMemo(() => buildSchedule(tasks, "daily").slice(0, 4), [tasks]);

  function loadSample() {
    const summary = mockSummarizeMeeting(SAMPLE_TRANSCRIPT, "Q3 launch sync");
    const meeting: MeetingSummary = {
      id: uid(),
      createdAt: Date.now(),
      transferred: true,
      ...summary,
    };
    const brief: ResearchBrief = {
      id: uid(),
      createdAt: Date.now(),
      ...mockResearch("Reducing meeting load on distributed teams", "article", SAMPLE_ARTICLE),
    };
    const newTasks: Task[] = summary.actionItems.map((a) => ({
      id: uid(),
      title: a.title,
      notes: `Owner: ${a.owner}`,
      priority: a.priority,
      due: a.due,
      estimateMins: a.estimateMins,
      completed: false,
      source: "meeting" as const,
      sourceLabel: meeting.title,
      createdAt: Date.now(),
    }));
    actions.addMeeting(meeting);
    actions.addBrief(brief);
    actions.addTasks(newTasks);
    toast.success("Sample workspace loaded");
  }

  const stats = [
    { label: "Open tasks", value: open.length, icon: CheckSquare, to: "/tasks" as const },
    { label: "Completed", value: done, icon: CheckCircle2, to: "/tasks" as const },
    { label: "Meeting summaries", value: meetings.length, icon: NotebookPen, to: "/meetings" as const },
    { label: "Research briefs", value: briefs.length, icon: BrainCircuit, to: "/research" as const },
  ];

  return (
    <div className="space-y-8">
      <section
        className="rounded-2xl p-8 text-navy-foreground shadow-[var(--shadow-elevated)]"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <Badge className="bg-white/15 text-navy-foreground">WorkFlow AI</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Turn information into action.
        </h1>
        <p className="mt-2 max-w-2xl text-navy-foreground/80">
          Summarize meetings, plan prioritized work and research faster — one connected workflow
          from raw notes to a realistic schedule.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="bg-cyan text-cyan-foreground hover:bg-cyan/90">
            <Link to="/meetings">
              <Sparkles className="mr-2 size-4" aria-hidden="true" />
              Summarize a meeting
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/40 bg-transparent text-navy-foreground hover:bg-white/10">
            <Link to="/tasks">Open task planner</Link>
          </Button>
          {tasks.length === 0 && meetings.length === 0 ? (
            <Button variant="ghost" className="text-navy-foreground hover:bg-white/10" onClick={loadSample}>
              Load sample workspace
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 pt-6">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's AI focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {focus.length === 0 ? (
              <p className="text-muted-foreground">
                No open tasks. Add one in the planner or transfer action items from a meeting.
              </p>
            ) : (
              focus.map((f, i) => {
                const task = tasks.find((t) => t.id === f.id);
                return (
                  <div key={f.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      {i + 1}. {task?.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{f.reason}</p>
                  </div>
                );
              })
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/tasks">Plan my day</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" aria-hidden="true" />
              Suggested blocks for today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {today.length === 0 ? (
              <p className="text-muted-foreground">Nothing scheduled — your day is clear.</p>
            ) : (
              today.map((b, i) => (
                <div key={`${b.taskId}-${i}`} className="flex items-center gap-3 rounded-md border p-2">
                  <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                    {b.start} – {b.end}
                  </span>
                  <span className="flex-1 truncate">{b.title}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={pct} aria-label={`${pct}% of tasks complete`} />
            <p className="text-sm text-muted-foreground">
              {done} of {tasks.length || 0} tasks complete ({pct}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {meetings.length === 0 && briefs.length === 0 ? (
              <p className="text-muted-foreground">No summaries or briefs yet.</p>
            ) : (
              [...meetings.map((m) => ({ id: m.id, when: m.createdAt, label: m.title, kind: "Meeting" })),
               ...briefs.map((b) => ({ id: b.id, when: b.createdAt, label: b.query, kind: "Research" }))]
                .sort((a, b) => b.when - a.when)
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Badge variant="secondary">{item.kind}</Badge>
                    <span className="truncate">{item.label}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
