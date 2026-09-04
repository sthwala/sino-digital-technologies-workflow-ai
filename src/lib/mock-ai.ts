// Deterministic heuristic "AI" engine used in demo mode and as fallback when no
// AI provider is configured. Pure functions — safe on both client and server.
import type {
  ActionItem,
  MeetingSummary,
  Priority,
  ResearchBrief,
  ResearchFinding,
  ScheduleBlock,
  Task,
} from "./types";

const STOP = new Set(
  "the a an and or but if then than that this these those we you they it he she is are was were be been being to of in on for with at by from as our your their about into over after before not no so will would can could should may might have has had do does did i'm we'll let's ok okay yeah just really very".split(
    " ",
  ),
);

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function keywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
    if (STOP.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function score(sentence: string, keys: string[]) {
  const low = sentence.toLowerCase();
  let s = 0;
  keys.forEach((k, i) => {
    if (low.includes(k)) s += keys.length - i;
  });
  if (/\d/.test(low)) s += 2;
  return s;
}

const ACTION_RE =
  /\b(will|need to|needs to|should|must|action item|todo|to-do|follow up|follow-up|assign|owns|take care of|by (monday|tuesday|wednesday|thursday|friday|next week|eod|friday))\b/i;
const DECISION_RE = /\b(decided|decision|agreed|approved|we'll go with|conclusion|signed off)\b/i;
const RISK_RE = /\b(risk|blocker|blocked|concern|issue|delay|dependency|uncertain|problem)\b/i;

function guessOwner(sentence: string): string {
  const m = sentence.match(/\b([A-Z][a-z]{2,})\b(?=\s+(will|to|is|should|owns|takes))/);
  if (m?.[1]) return m[1];
  const first = sentence.match(/^([A-Z][a-z]{2,})\s*:/);
  return first?.[1] ?? "Unassigned";
}

function guessPriority(sentence: string): Priority {
  const low = sentence.toLowerCase();
  if (/\b(urgent|asap|critical|today|eod|blocker|immediately)\b/.test(low)) return "high";
  if (/\b(next week|later|eventually|nice to have|backlog)\b/.test(low)) return "low";
  return "medium";
}

function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function guessDue(sentence: string): string {
  const low = sentence.toLowerCase();
  if (/\b(today|eod|asap|urgent)\b/.test(low)) return offsetDate(0);
  if (/\btomorrow\b/.test(low)) return offsetDate(1);
  if (/\bnext week\b/.test(low)) return offsetDate(7);
  if (/\bfriday\b/.test(low)) return offsetDate(((5 - new Date().getDay() + 7) % 7) || 7);
  return offsetDate(3);
}

function cleanAction(sentence: string) {
  return titleCase(
    sentence
      .replace(/^[A-Z][a-z]+\s*:\s*/, "")
      .replace(/\b(we|i|they)\s+(will|need to|should|must)\s+/i, "")
      .replace(/[.!?]+$/, "")
      .trim(),
  ).slice(0, 120);
}

export function mockSummarizeMeeting(
  transcript: string,
  title: string,
): Omit<MeetingSummary, "id" | "createdAt" | "transferred"> {
  const sents = sentences(transcript);
  const keys = keywords(transcript, 10);
  const ranked = [...sents].sort((a, b) => score(b, keys) - score(a, keys));

  const actionSents = sents.filter((s) => ACTION_RE.test(s)).slice(0, 6);
  const decisions = sents.filter((s) => DECISION_RE.test(s)).slice(0, 4);
  const risks = sents.filter((s) => RISK_RE.test(s)).slice(0, 4);

  const keyPoints = ranked
    .filter((s) => !actionSents.includes(s) && !decisions.includes(s))
    .slice(0, 5);

  const actionItems: ActionItem[] = (actionSents.length ? actionSents : ranked.slice(0, 3)).map(
    (s) => ({
      title: cleanAction(s),
      owner: guessOwner(s),
      due: guessDue(s),
      priority: guessPriority(s),
      estimateMins: Math.min(180, 30 + Math.round(s.length / 4 / 5) * 5),
    }),
  );

  const topic = keys.slice(0, 3).join(", ") || "the discussion";
  const summary =
    `This session covered ${topic}. ` +
    ranked.slice(0, 3).join(" ").slice(0, 480) +
    (sents.length > 3 ? ` In total ${sents.length} discussion points were captured.` : "");

  return {
    title: title.trim() || `Meeting notes — ${new Date().toLocaleDateString()}`,
    transcript,
    summary,
    keyPoints: keyPoints.length ? keyPoints : ranked.slice(0, 3),
    decisions,
    risks,
    actionItems,
    demo: true,
  };
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 40, medium: 22, low: 8 };

export function prioritizeTasks(tasks: Task[]): { id: string; score: number; reason: string }[] {
  const today = new Date().setHours(0, 0, 0, 0);
  return tasks
    .filter((t) => !t.completed)
    .map((t) => {
      const reasons: string[] = [];
      let s = PRIORITY_WEIGHT[t.priority];
      reasons.push(`${titleCase(t.priority)} stated priority (+${PRIORITY_WEIGHT[t.priority]})`);

      if (t.due) {
        const days = Math.round((new Date(t.due).setHours(0, 0, 0, 0) - today) / 86400000);
        const dueBoost = days < 0 ? 45 : days === 0 ? 35 : days <= 2 ? 25 : days <= 7 ? 12 : 4;
        s += dueBoost;
        reasons.push(
          days < 0
            ? `Overdue by ${Math.abs(days)} day(s) (+${dueBoost})`
            : days === 0
              ? `Due today (+${dueBoost})`
              : `Due in ${days} day(s) (+${dueBoost})`,
        );
      } else {
        reasons.push("No due date, scheduled opportunistically (+0)");
      }

      if (t.source === "meeting") {
        s += 8;
        reasons.push("Committed to in a meeting (+8)");
      }
      if (t.estimateMins <= 30) {
        s += 6;
        reasons.push("Quick win under 30 min (+6)");
      } else if (t.estimateMins >= 120) {
        s -= 4;
        reasons.push("Large block, needs focus time (-4)");
      }

      return { id: t.id, score: Math.max(1, Math.round(s)), reason: reasons.join(" · ") };
    })
    .sort((a, b) => b.score - a.score);
}

const WORK_START = 9 * 60;
const LUNCH = 12 * 60;
const DAY_END = 17 * 60;

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function buildSchedule(tasks: Task[], mode: "daily" | "weekly"): ScheduleBlock[] {
  const ranked = prioritizeTasks(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const days = mode === "daily" ? 1 : 5;
  const dayNames = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  });

  const blocks: ScheduleBlock[] = [];
  let day = 0;
  let cursor = WORK_START;

  for (const r of ranked) {
    const task = byId.get(r.id);
    if (!task || day >= days) continue;
    const len = Math.max(25, Math.min(120, task.estimateMins || 45));
    if (cursor < LUNCH && cursor + len > LUNCH) cursor = LUNCH + 60;
    if (cursor + len > DAY_END) {
      day += 1;
      cursor = WORK_START;
      if (day >= days) break;
    }
    blocks.push({
      day: dayNames[day] ?? "",
      start: fmt(cursor),
      end: fmt(cursor + len),
      taskId: task.id,
      title: task.title,
      priority: task.priority,
    });
    cursor += len + 10;
  }
  return blocks;
}

export function mockResearch(
  query: string,
  kind: "research" | "article",
  body = "",
): Omit<ResearchBrief, "id" | "createdAt"> {
  const source = body.trim() || query;
  const keys = keywords(source, 8);
  const sents = sentences(source);
  const ranked = [...sents].sort((a, b) => score(b, keys) - score(a, keys));
  const topic = query.trim() || keys.slice(0, 3).join(" ");

  const findings: ResearchFinding[] = (
    ranked.length >= 3
      ? ranked.slice(0, 4)
      : keys.slice(0, 4).map((k) => `${titleCase(k)} is a recurring theme worth investigating.`)
  ).map((claim, i) => ({
    claim: claim.slice(0, 160),
    detail:
      kind === "article"
        ? "Extracted from the supplied text and condensed; verify against the original before citing."
        : `Synthesised from general knowledge about ${topic}. Treat as a starting hypothesis, not a verified fact.`,
    confidence: i === 0 ? "high" : i < 3 ? "medium" : "low",
  }));

  const overview =
    kind === "article"
      ? `Condensed read of the supplied article on ${topic}. ` + ranked.slice(0, 3).join(" ").slice(0, 420)
      : `Structured starting brief on ${topic}. The strongest themes are ${keys.slice(0, 4).join(", ") || topic}. ` +
        `Use the findings below to frame the problem, then validate each with a primary source.`;

  return {
    kind,
    query: topic,
    overview,
    findings,
    openQuestions: [
      `What primary sources confirm the claims about ${keys[0] ?? topic}?`,
      `Who are the main stakeholders affected by ${topic}?`,
      `What would make this conclusion wrong?`,
    ],
    nextSteps: [
      `Collect two authoritative sources on ${topic}`,
      `Draft a one-page summary for the team`,
      `Turn the strongest finding into a tracked task`,
    ],
    sources: [
      { label: kind === "article" ? "Supplied text" : "Model general knowledge", note: "Unverified — confirm before relying on it." },
      { label: "Suggested: peer-reviewed or official docs", note: "Add your own citations here." },
    ],
    demo: true,
  };
}
