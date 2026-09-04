import { useCallback, useSyncExternalStore } from "react";
import type { MeetingSummary, ResearchBrief, Task } from "./types";

const KEY = "workflow-ai:v1";

export interface AppData {
  tasks: Task[];
  meetings: MeetingSummary[];
  briefs: ResearchBrief[];
}

const EMPTY: AppData = { tasks: [], meetings: [], briefs: [] };

let cache: AppData = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): AppData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      tasks: parsed.tasks ?? [],
      meetings: parsed.meetings ?? [],
      briefs: parsed.briefs ?? [],
    };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    cache = read();
    loaded = true;
  }
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

export function setData(updater: (prev: AppData) => AppData) {
  cache = updater(ensureLoaded());
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* quota — keep in-memory copy */
    }
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, ensureLoaded, () => EMPTY);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function useActions() {
  return useCallback(
    () => ({
      addTasks: (tasks: Task[]) => setData((d) => ({ ...d, tasks: [...tasks, ...d.tasks] })),
      updateTask: (id: string, patch: Partial<Task>) =>
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTask: (id: string) =>
        setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) })),
      addMeeting: (m: MeetingSummary) =>
        setData((d) => ({ ...d, meetings: [m, ...d.meetings] })),
      updateMeeting: (id: string, patch: Partial<MeetingSummary>) =>
        setData((d) => ({
          ...d,
          meetings: d.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMeeting: (id: string) =>
        setData((d) => ({ ...d, meetings: d.meetings.filter((m) => m.id !== id) })),
      addBrief: (b: ResearchBrief) => setData((d) => ({ ...d, briefs: [b, ...d.briefs] })),
      removeBrief: (id: string) =>
        setData((d) => ({ ...d, briefs: d.briefs.filter((b) => b.id !== id) })),
      clearAll: () => setData(() => EMPTY),
    }),
    [],
  )();
}
