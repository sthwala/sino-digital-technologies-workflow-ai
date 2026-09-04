import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRightCircle,
  FileUp,
  Loader2,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { summarizeMeeting } from "@/lib/ai.functions";
import { SAMPLE_TRANSCRIPT } from "@/lib/samples";
import { uid, useActions, useAppData } from "@/lib/store";
import type { ActionItem, MeetingSummary, Priority, Task } from "@/lib/types";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "AI Meeting Notes Summarizer — WorkFlow AI" },
      {
        name: "description",
        content:
          "Paste or upload a transcript and get an editable summary, decisions, risks and action items you can send straight to the task planner.",
      },
      { property: "og:title", content: "AI Meeting Notes Summarizer — WorkFlow AI" },
      {
        property: "og:description",
        content: "Editable AI meeting summaries with one-click transfer to your task planner.",
      },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const { meetings } = useAppData();
  const actions = useActions();
  const summarize = useServerFn(summarizeMeeting);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<MeetingSummary | null>(null);

  async function handleFile(file: File) {
    if (file.size > 1_000_000) {
      setError("That file is larger than 1 MB. Paste the relevant excerpt instead.");
      return;
    }
    const text = await file.text();
    setTranscript(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setError("");
    toast.success(`Loaded ${file.name}`);
  }

  async function run() {
    if (transcript.trim().length < 40) {
      setError("Paste at least a couple of sentences of notes before summarizing.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await summarize({ data: { transcript, title } });
      setDraft({
        id: uid(),
        createdAt: Date.now(),
        transferred: false,
        ...result,
      } as MeetingSummary);
      toast.success("Summary ready — review and edit before saving");
    } catch (e) {
      console.error(e);
      setError("The summarizer could not complete. Please try again.");
      toast.error("Summarization failed");
    } finally {
      setLoading(false);
    }
  }

  function patchDraft(patch: Partial<MeetingSummary>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function patchAction(index: number, patch: Partial<ActionItem>) {
    setDraft((d) =>
      d
        ? { ...d, actionItems: d.actionItems.map((a, i) => (i === index ? { ...a, ...patch } : a)) }
        : d,
    );
  }

  function transfer(meeting: MeetingSummary) {
    if (meeting.actionItems.length === 0) {
      toast.error("This summary has no action items to transfer.");
      return;
    }
    const tasks: Task[] = meeting.actionItems.map((a) => ({
      id: uid(),
      title: a.title,
      notes: a.owner && a.owner !== "Unassigned" ? `Owner: ${a.owner}` : "",
      priority: a.priority,
      due: a.due,
      estimateMins: a.estimateMins || 45,
      completed: false,
      source: "meeting" as const,
      sourceLabel: meeting.title,
      createdAt: Date.now(),
    }));
    actions.addTasks(tasks);
    if (meetings.some((m) => m.id === meeting.id)) {
      actions.updateMeeting(meeting.id, { transferred: true });
    } else {
      actions.addMeeting({ ...meeting, transferred: true });
      setDraft(null);
    }
    toast.success(`${tasks.length} action item(s) sent to Task Planner`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Meeting Notes Summarizer</h1>
        <p className="mt-1 text-muted-foreground">
          Paste or upload notes, get structured results you can edit, then push action items into
          the planner.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="size-4" aria-hidden="true" />
            New summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Meeting title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly product sync"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meeting-transcript">Transcript or notes</Label>
            <Textarea
              id="meeting-transcript"
              rows={10}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your raw meeting notes or transcript here…"
            />
            <p className="text-xs text-muted-foreground">
              {transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : "No text yet"}
            </p>
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2 size-4" aria-hidden="true" />
              )}
              {loading ? "Summarizing…" : "Summarize notes"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.vtt,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-2 size-4" aria-hidden="true" />
              Upload .txt / .md
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTranscript(SAMPLE_TRANSCRIPT);
                setTitle("Q3 launch sync");
                setError("");
              }}
            >
              Use sample transcript
            </Button>
          </div>
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Editable results</CardTitle>
            <Badge className={draft.demo ? "bg-cyan text-cyan-foreground" : "bg-success text-white"}>
              {draft.demo ? "Demo mode result" : "Live AI result"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="draft-summary">Summary</Label>
              <Textarea
                id="draft-summary"
                rows={4}
                value={draft.summary}
                onChange={(e) => patchDraft({ summary: e.target.value })}
              />
            </div>

            {(["keyPoints", "decisions", "risks"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`draft-${field}`}>
                  {field === "keyPoints" ? "Key points" : field === "decisions" ? "Decisions" : "Risks & blockers"}
                </Label>
                <Textarea
                  id={`draft-${field}`}
                  rows={3}
                  value={draft[field].join("\n")}
                  onChange={(e) =>
                    patchDraft({ [field]: e.target.value.split("\n").filter(Boolean) } as Partial<MeetingSummary>)
                  }
                />
                <p className="text-xs text-muted-foreground">One item per line.</p>
              </div>
            ))}

            <div className="space-y-3">
              <h3 className="font-medium">Action items</h3>
              {draft.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No action items detected.</p>
              ) : (
                draft.actionItems.map((a, i) => (
                  <div key={i} className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                    <Input
                      aria-label={`Action ${i + 1} title`}
                      value={a.title}
                      onChange={(e) => patchAction(i, { title: e.target.value })}
                    />
                    <Input
                      aria-label={`Action ${i + 1} owner`}
                      value={a.owner}
                      onChange={(e) => patchAction(i, { owner: e.target.value })}
                    />
                    <Input
                      type="date"
                      aria-label={`Action ${i + 1} due date`}
                      value={a.due}
                      onChange={(e) => patchAction(i, { due: e.target.value })}
                    />
                    <Select
                      value={a.priority}
                      onValueChange={(v) => patchAction(i, { priority: v as Priority })}
                    >
                      <SelectTrigger aria-label={`Action ${i + 1} priority`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  actions.addMeeting(draft);
                  setDraft(null);
                  setTranscript("");
                  setTitle("");
                  toast.success("Summary saved");
                }}
              >
                Save summary
              </Button>
              <Button variant="outline" onClick={() => transfer(draft)}>
                <ArrowRightCircle className="mr-2 size-4" aria-hidden="true" />
                Save & send action items to planner
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Saved summaries</h2>
        {meetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No saved summaries yet. Summarize your first meeting above.
            </CardContent>
          </Card>
        ) : (
          meetings.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()} · {m.actionItems.length} action item(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.transferred ? <Badge variant="secondary">Transferred</Badge> : null}
                  <Badge className={m.demo ? "bg-cyan text-cyan-foreground" : "bg-success text-white"}>
                    {m.demo ? "Demo" : "Live AI"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{m.summary}</p>
                {m.keyPoints.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {m.keyPoints.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => transfer(m)}>
                    <ArrowRightCircle className="mr-2 size-4" aria-hidden="true" />
                    Send action items to planner
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/tasks">Open planner</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      actions.removeMeeting(m.id);
                      toast.success("Summary deleted");
                    }}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
