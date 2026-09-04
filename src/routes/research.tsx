import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { runResearch } from "@/lib/ai.functions";
import { SAMPLE_ARTICLE } from "@/lib/samples";
import { uid, useActions, useAppData } from "@/lib/store";
import type { ResearchBrief } from "@/lib/types";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "AI Research Assistant — WorkFlow AI" },
      {
        name: "description",
        content:
          "Ask a research question or paste an article to get a structured brief with findings, confidence levels, open questions and next steps.",
      },
      { property: "og:title", content: "AI Research Assistant — WorkFlow AI" },
      {
        property: "og:description",
        content: "Structured research briefs and article summaries you can turn into tasks.",
      },
    ],
  }),
  component: ResearchPage,
});

const CONFIDENCE: Record<string, string> = {
  high: "bg-success/15 text-foreground border-success/40",
  medium: "bg-warning/15 text-foreground border-warning/40",
  low: "bg-secondary text-secondary-foreground border-border",
};

function ResearchPage() {
  const { briefs } = useAppData();
  const actions = useActions();
  const research = useServerFn(runResearch);

  const [query, setQuery] = useState("");
  const [article, setArticle] = useState("");
  const [loading, setLoading] = useState<"research" | "article" | null>(null);
  const [error, setError] = useState("");

  async function run(kind: "research" | "article") {
    if (kind === "research" && query.trim().length < 5) {
      setError("Enter a research question of at least a few words.");
      return;
    }
    if (kind === "article" && article.trim().length < 60) {
      setError("Paste a longer piece of text to summarize.");
      return;
    }
    setError("");
    setLoading(kind);
    try {
      const result = await research({
        data: {
          kind,
          query: kind === "research" ? query : query || "Article summary",
          body: kind === "article" ? article : "",
        },
      });
      const brief: ResearchBrief = { id: uid(), createdAt: Date.now(), ...result } as ResearchBrief;
      actions.addBrief(brief);
      toast.success(kind === "article" ? "Article summarized" : "Research brief ready");
      if (kind === "article") setArticle("");
      else setQuery("");
    } catch (e) {
      console.error(e);
      setError("The research assistant could not complete. Please try again.");
      toast.error("Request failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Research Assistant</h1>
        <p className="mt-1 text-muted-foreground">
          Frame a question or condense an article, then turn the strongest findings into tracked
          tasks.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="size-4" aria-hidden="true" />
            Start a brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="research">
            <TabsList>
              <TabsTrigger value="research">Research question</TabsTrigger>
              <TabsTrigger value="article">Summarize article</TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="mt-4 space-y-3">
              <Label htmlFor="research-query">What do you want to understand?</Label>
              <Input
                id="research-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="How do distributed teams reduce meeting load without losing alignment?"
              />
              <Button onClick={() => run("research")} disabled={loading !== null}>
                {loading === "research" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="mr-2 size-4" aria-hidden="true" />
                )}
                {loading === "research" ? "Researching…" : "Build research brief"}
              </Button>
            </TabsContent>

            <TabsContent value="article" className="mt-4 space-y-3">
              <Label htmlFor="research-article">Paste the article text</Label>
              <Textarea
                id="research-article"
                rows={8}
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                placeholder="Paste the full article text here…"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => run("article")} disabled={loading !== null}>
                  {loading === "article" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {loading === "article" ? "Summarizing…" : "Summarize article"}
                </Button>
                <Button variant="ghost" onClick={() => setArticle(SAMPLE_ARTICLE)}>
                  Use sample article
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          {error ? (
            <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Saved briefs</h2>
        {briefs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No briefs yet. Ask a question or summarize an article to get started.
            </CardContent>
          </Card>
        ) : (
          briefs.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{b.query}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {b.kind === "article" ? "Article summary" : "Research brief"} ·{" "}
                    {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge className={b.demo ? "bg-cyan text-cyan-foreground" : "bg-success text-white"}>
                  {b.demo ? "Demo" : "Live AI"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{b.overview}</p>

                <div className="space-y-2">
                  <h3 className="font-medium">Findings</h3>
                  {b.findings.map((f, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">{f.claim}</p>
                        <Badge variant="outline" className={CONFIDENCE[f.confidence] ?? ""}>
                          {f.confidence} confidence
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => {
                          actions.addTasks([
                            {
                              id: uid(),
                              title: `Verify: ${f.claim}`.slice(0, 120),
                              notes: `From research brief “${b.query}”`,
                              priority: "medium",
                              due: "",
                              estimateMins: 45,
                              completed: false,
                              source: "research",
                              sourceLabel: b.query,
                              createdAt: Date.now(),
                            },
                          ]);
                          toast.success("Task created in planner");
                        }}
                      >
                        <Plus className="mr-2 size-4" aria-hidden="true" />
                        Create task
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-medium">Open questions</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {b.openQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium">Next steps</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {b.nextSteps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Sources & caveats</h3>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {b.sources.map((s, i) => (
                      <li key={i}>
                        <strong>{s.label}:</strong> {s.note}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    actions.removeBrief(b.id);
                    toast.success("Brief deleted");
                  }}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  Delete brief
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
