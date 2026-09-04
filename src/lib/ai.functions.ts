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
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return { ...fallback, ...parsed, title: fallback.title, transcript: data.transcript, demo: false };
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
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return { ...fallback, ...parsed, kind: data.kind, query: data.query, demo: false };
    } catch (error) {
      console.error(error);
      return fallback;
    }
  });
