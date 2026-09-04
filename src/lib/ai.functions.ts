import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { mockResearch, mockSummarizeMeeting } from "./mock-ai";

const MODEL = "google/gemini-3.7-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(system: string, user: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`AI gateway ${res.status}: ${message.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? null;
}

type Loose = Record<string, unknown>;
const str = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : []);
const prio = (v: unknown) => (v === "high" || v === "low" ? v : "medium") as "high" | "medium" | "low";

export const getAiMode = createServerFn({ method: "GET" }).handler(async () => ({
  live: Boolean(process.env["LOVABLE_API_KEY"]),
}));

const MeetingInput = z.object({ transcript: z.string().min(1), title: z.string().default("") });

export const summarizeMeeting = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => MeetingInput.parse(i))
  .handler(async ({ data }) => {
    const fallback = { ...mockSummarizeMeeting(data.transcript, data.title), demo: true };
    try {
      const raw = await callGateway(
        "You summarize meeting transcripts. Reply with JSON only: {summary, keyPoints[], decisions[], risks[], actionItems:[{title, owner, due (yyyy-mm-dd), priority (high|medium|low), estimateMins}]}.",
        `Title: ${data.title}\n\nTranscript:\n${data.transcript.slice(0, 20000)}`,
      );
      if (!raw) return fallback;
      const p = JSON.parse(raw) as Loose;
      const items = Array.isArray(p["actionItems"]) ? (p["actionItems"] as Loose[]) : [];
      return {
        ...fallback,
        summary: str(p["summary"], fallback.summary),
        keyPoints: list(p["keyPoints"]),
        decisions: list(p["decisions"]),
        risks: list(p["risks"]),
        actionItems: items.map((a) => ({
          title: str(a["title"]).slice(0, 160),
          owner: str(a["owner"], "Unassigned"),
          due: /^\d{4}-\d{2}-\d{2}$/.test(str(a["due"])) ? str(a["due"]) : "",
          priority: prio(a["priority"]),
          estimateMins: typeof a["estimateMins"] === "number" ? a["estimateMins"] : 45,
        })).filter((a) => a.title),
        title: fallback.title,
        transcript: data.transcript,
        demo: false,
      };
    } catch (error) {
      console.error(error);
      return fallback;
    }
  });

const ResearchInput = z.object({
  query: z.string().min(1),
  kind: z.enum(["research", "article"]),
  body: z.string().default(""),
});

export const runResearch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ResearchInput.parse(i))
  .handler(async ({ data }) => {
    const fallback = { ...mockResearch(data.query, data.kind, data.body), demo: true };
    try {
      const raw = await callGateway(
        "You are a careful research assistant. Reply with JSON only: {overview, findings:[{claim, detail, confidence (high|medium|low)}], openQuestions[], nextSteps[], sources:[{label, note}]}. Never invent citations.",
        data.kind === "article"
          ? `Summarize this article:\n${data.body.slice(0, 20000)}`
          : `Research question: ${data.query}`,
      );
      if (!raw) return fallback;
      const p = JSON.parse(raw) as Loose;
      const findings = Array.isArray(p["findings"]) ? (p["findings"] as Loose[]) : [];
      const sources = Array.isArray(p["sources"]) ? (p["sources"] as Loose[]) : [];
      return {
        ...fallback,
        overview: str(p["overview"], fallback.overview),
        findings: findings
          .map((f) => ({
            claim: str(f["claim"]),
            detail: str(f["detail"]),
            confidence: (f["confidence"] === "high" || f["confidence"] === "low"
              ? f["confidence"]
              : "medium") as "high" | "medium" | "low",
          }))
          .filter((f) => f.claim),
        openQuestions: list(p["openQuestions"]),
        nextSteps: list(p["nextSteps"]),
        sources: sources.map((s2) => ({ label: str(s2["label"], "Source"), note: str(s2["note"]) })),
        kind: data.kind,
        query: data.query,
        demo: false,
      };
    } catch (error) {
      console.error(error);
      return fallback;
    }
  });
