export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  due: string; // ISO date (yyyy-mm-dd) or ""
  estimateMins: number;
  completed: boolean;
  source: "manual" | "meeting" | "research";
  sourceLabel?: string;
  createdAt: number;
  aiScore?: number;
  aiReason?: string;
}

export interface ActionItem {
  title: string;
  owner: string;
  due: string;
  priority: Priority;
  estimateMins: number;
}

export interface MeetingSummary {
  id: string;
  title: string;
  createdAt: number;
  transcript: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  risks: string[];
  actionItems: ActionItem[];
  demo: boolean;
  transferred: boolean;
}

export interface ResearchFinding {
  claim: string;
  detail: string;
  confidence: "high" | "medium" | "low";
}

export interface ResearchBrief {
  id: string;
  kind: "research" | "article";
  query: string;
  createdAt: number;
  overview: string;
  findings: ResearchFinding[];
  openQuestions: string[];
  nextSteps: string[];
  sources: { label: string; note: string }[];
  demo: boolean;
}

export interface ScheduleBlock {
  day: string;
  start: string;
  end: string;
  taskId: string;
  title: string;
  priority: Priority;
}
