import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildSchedule, prioritizeTasks } from "@/lib/mock-ai";
import { uid, useActions, useAppData } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Task Planner — WorkFlow AI" },
      {
        name: "description",
        content:
          "Create, search and filter tasks, get AI prioritization with explanations, and generate realistic daily or weekly schedules.",
      },
      { property: "og:title", content: "Task Planner — WorkFlow AI" },
      {
        property: "og:description",
        content: "AI-prioritized tasks with transparent explanations and realistic schedules.",
      },
    ],
  }),
  component: TasksPage,
});

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-foreground border-warning/40",
  low: "bg-secondary text-secondary-foreground border-border",
};

export function emptyTask(): Task {
  return {
    id: uid(),
    title: "",
    notes: "",
    priority: "medium",
    due: "",
    estimateMins: 45,
    completed: false,
    source: "manual",
    createdAt: Date.now(),
  };
}

function TaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (t: Task) => void;
}) {
  const [draft, setDraft] = useState<Task>(task);
  const [error, setError] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setDraft(task);
          setError("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.title ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Draft the Q3 rollout plan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={draft.priority}
                onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={draft.due}
                onChange={(e) => setDraft({ ...draft, due: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-estimate">Estimate (min)</Label>
              <Input
                id="task-estimate"
                type="number"
                min={5}
                step={5}
                value={draft.estimateMins}
                onChange={(e) =>
                  setDraft({ ...draft, estimateMins: Number(e.target.value) || 30 })
                }
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!draft.title.trim()) {
                setError("Give the task a title first.");
                return;
              }
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksPage() {
  const { tasks } = useAppData();
  const actions = useActions();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [source, setSource] = useState("all");
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [prioritizing, setPrioritizing] = useState(false);
  const [ranked, setRanked] = useState<{ id: string; score: number; reason: string }[] | null>(
    null,
  );
  const [scheduleMode, setScheduleMode] = useState<"daily" | "weekly">("daily");
  const [schedule, setSchedule] = useState<ReturnType<typeof buildSchedule> | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (status === "all" ? true : status === "open" ? !t.completed : t.completed))
      .filter((t) => (priority === "all" ? true : t.priority === priority))
      .filter((t) => (source === "all" ? true : t.source === source))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0) || b.createdAt - a.createdAt);
  }, [tasks, query, status, priority, source]);

  const openCount = tasks.filter((t) => !t.completed).length;

  function runPrioritize() {
    if (openCount === 0) {
      toast.error("Add at least one open task first.");
      return;
    }
    setPrioritizing(true);
    setTimeout(() => {
      const result = prioritizeTasks(tasks);
      setRanked(result);
      result.forEach((r) => actions.updateTask(r.id, { aiScore: r.score, aiReason: r.reason }));
      setPrioritizing(false);
      toast.success(`Prioritized ${result.length} task${result.length === 1 ? "" : "s"}`);
    }, 500);
  }

  function generateSchedule(mode: "daily" | "weekly") {
    if (openCount === 0) {
      toast.error("No open tasks to schedule.");
      return;
    }
    setScheduleMode(mode);
    setSchedule(buildSchedule(tasks, mode));
    toast.success(`${mode === "daily" ? "Daily" : "Weekly"} schedule generated`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Planner</h1>
          <p className="mt-1 text-muted-foreground">
            {openCount} open · {tasks.length - openCount} completed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runPrioritize} disabled={prioritizing}>
            {prioritizing ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="mr-2 size-4" aria-hidden="true" />
            )}
            Prioritize with AI
          </Button>
          <Button onClick={() => setDialogTask(emptyTask())}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            New task
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger aria-label="Filter by source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="meeting">From meeting</SelectItem>
                <SelectItem value="research">From research</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CheckSquare className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No tasks match your filters</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Create a task manually, or summarize a meeting and transfer its action items here.
            </p>
            <Button onClick={() => setDialogTask(emptyTask())}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((task) => (
            <li key={task.id}>
              <Card className={task.completed ? "opacity-70" : ""}>
                <CardContent className="flex items-start gap-3 pt-6">
                  <Checkbox
                    className="mt-1"
                    checked={task.completed}
                    aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`}
                    onCheckedChange={(v) => {
                      actions.updateTask(task.id, { completed: Boolean(v) });
                      toast.success(v ? "Task completed" : "Task reopened");
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                      {task.title}
                    </p>
                    {task.notes ? (
                      <p className="mt-1 text-sm text-muted-foreground">{task.notes}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className={PRIORITY_STYLE[task.priority]}>
                        {task.priority}
                      </Badge>
                      {task.due ? (
                        <span className="text-muted-foreground">Due {task.due}</span>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                      <span className="text-muted-foreground">{task.estimateMins} min</span>
                      {task.source !== "manual" ? (
                        <Badge variant="secondary">
                          {task.source === "meeting" ? "From meeting" : "From research"}
                        </Badge>
                      ) : null}
                      {task.aiScore ? (
                        <Badge className="bg-cyan text-cyan-foreground">
                          AI score {task.aiScore}
                        </Badge>
                      ) : null}
                    </div>
                    {task.aiReason ? (
                      <p className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-secondary-foreground">
                        <strong>Why this rank:</strong> {task.aiReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => setDialogTask(task)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${task.title}`}
                      onClick={() => {
                        actions.removeTask(task.id);
                        toast.success("Task deleted");
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" aria-hidden="true" />
            Suggested schedule
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateSchedule("daily")}>
              Daily plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateSchedule("weekly")}>
              Weekly plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!schedule ? (
            <p className="text-sm text-muted-foreground">
              Generate a plan to slot open tasks into 9:00–17:00 working blocks with a lunch break
              and buffers between items.
            </p>
          ) : schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to schedule — every task is complete.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {scheduleMode === "daily" ? "Today" : "Next 5 working days"} · highest AI-ranked
                work first.
              </p>
              {[...new Set(schedule.map((b) => b.day))].map((day) => (
                <div key={day}>
                  <h3 className="text-sm font-semibold">{day}</h3>
                  <ul className="mt-2 space-y-2">
                    {schedule
                      .filter((b) => b.day === day)
                      .map((b, i) => (
                        <li
                          key={`${b.taskId}-${i}`}
                          className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm"
                        >
                          <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                            {b.start} – {b.end}
                          </span>
                          <span className="flex-1">{b.title}</span>
                          <Badge variant="outline" className={PRIORITY_STYLE[b.priority]}>
                            {b.priority}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {ranked && ranked.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI prioritization explained</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Scores combine stated priority, due-date urgency, meeting commitments and effort.
              Demo mode uses a transparent rule-based model — every point is accounted for below.
            </p>
            <ol className="space-y-2">
              {ranked.map((r, i) => {
                const task = tasks.find((t) => t.id === r.id);
                return (
                  <li key={r.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      {i + 1}. {task?.title ?? "Task"}{" "}
                      <span className="text-muted-foreground">({r.score})</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {dialogTask ? (
        <TaskDialog
          key={dialogTask.id}
          task={dialogTask}
          open={Boolean(dialogTask)}
          onOpenChange={(v) => !v && setDialogTask(null)}
          onSave={(t) => {
            if (tasks.some((x) => x.id === t.id)) {
              actions.updateTask(t.id, t);
              toast.success("Task updated");
            } else {
              actions.addTasks([t]);
              toast.success("Task created");
            }
          }}
        />
      ) : null}
    </div>
  );
}
