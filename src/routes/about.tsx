import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Eye, Server, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActions } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Responsible AI — WorkFlow AI" },
      {
        name: "description",
        content:
          "How WorkFlow AI generates results, what demo mode means, where your data lives, and the limits of AI output.",
      },
      { property: "og:title", content: "Responsible AI — WorkFlow AI" },
      {
        property: "og:description",
        content: "Transparency about demo mode, data storage and the limits of AI output.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const actions = useActions();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Responsible AI notice</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          WorkFlow AI is an assistant, not an authority. Everything it produces is a draft for you
          to review.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            icon: Eye,
            title: "Demo mode by default",
            body: "Without a configured AI provider, summaries, briefs, priorities and schedules come from an on-device heuristic engine. Results are labelled 'Demo' so you always know their origin.",
          },
          {
            icon: Server,
            title: "Keys stay server-side",
            body: "When a provider is configured, model calls run inside server functions. API keys are never shipped to the browser and never appear in client code or network responses.",
          },
          {
            icon: ShieldCheck,
            title: "Verify before acting",
            body: "AI can misattribute owners, invent deadlines, or overstate confidence. Check action items, dates and research claims against primary sources before you commit to them.",
          },
          {
            icon: Trash2,
            title: "Your data, your device",
            body: "Meetings, tasks and briefs are stored in this browser's local storage. Nothing is shared with other users. Clearing the data below removes it permanently.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage your data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="destructive"
            onClick={() => {
              actions.clearAll();
              toast.success("All local WorkFlow AI data cleared");
            }}
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" />
            Clear all data
          </Button>
          <span className="text-sm text-muted-foreground">
            Removes every meeting, task and research brief from this browser.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
