// Work that must survive leaving a page.
//
// Reading a photo, cutting a garment out of it and uploading it take seconds. React throws all of a
// screen's state away the moment a shopper taps Wardrobe, so that work used to be abandoned halfway
// and the form came back empty — on a phone, where the bottom bar is one thumb away, constantly.
// Everything here lives outside React: the job keeps running, and coming back picks it straight up.
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type JobState<T> = { status: "idle" | "running" | "done" | "failed"; value?: T; error?: unknown };

const IDLE: JobState<never> = { status: "idle" };

// Enough for a photo, a garment, its cut-out and the uploads of each, with room to spare
const MAX_JOBS = 12;

const jobs = new Map<string, JobState<unknown>>();
const disposers = new Map<string, (value: unknown) => void>();
const kept = new Map<string, unknown>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function finish(key: string, state: JobState<unknown>) {
  if (!jobs.has(key)) {
    // Forgotten while it ran: whatever it made still needs letting go of
    if (state.status === "done") disposers.get(key)?.(state.value);
    disposers.delete(key);
    return;
  }
  jobs.set(key, state);
  for (const [oldest, old] of jobs) {
    if (jobs.size <= MAX_JOBS) break;
    if (oldest === key || old.status === "running") continue;
    jobs.delete(oldest);
    if (old.status === "done") disposers.get(oldest)?.(old.value);
    disposers.delete(oldest);
  }
  emit();
}

/**
 * Runs `start` once for this key. Calling it again with the same key returns the work already in
 * flight (or its result) instead of starting over. `dispose` lets go of what the job made — an
 * object URL, say — whenever the job is dropped.
 */
export function startJob<T>(key: string, start: () => Promise<T>, dispose?: (value: T) => void): JobState<T> {
  const already = jobs.get(key) as JobState<T> | undefined;
  if (already) return already;
  jobs.set(key, { status: "running" });
  if (dispose) disposers.set(key, dispose as (value: unknown) => void);
  start().then(
    (value) => finish(key, { status: "done", value }),
    (error) => finish(key, { status: "failed", error }),
  );
  emit();
  return jobs.get(key) as JobState<T>;
}

/** Drops a job, so the same key can be run afresh, letting go of whatever it made. */
export function forgetJob(key: string) {
  const job = jobs.get(key);
  jobs.delete(key);
  if (job?.status === "done") disposers.get(key)?.(job.value);
  disposers.delete(key);
  emit();
}

/** Starts `start` when `key` is set, and reports on it for as long as anything is watching. */
export function useJob<T>(key: string | null, start: () => Promise<T>, dispose?: (value: T) => void): JobState<T> {
  const latest = useRef({ start, dispose });
  latest.current = { start, dispose };
  useEffect(() => {
    if (key) startJob(key, () => latest.current.start(), (value: T) => latest.current.dispose?.(value));
  }, [key]);
  return useSyncExternalStore(
    subscribe,
    () => (key ? ((jobs.get(key) as JobState<T> | undefined) ?? IDLE) : IDLE) as JobState<T>,
  );
}

/**
 * A piece of screen state — the photo someone picked, what they typed about it — that outlives
 * leaving the page. `initial` must be the same value every render (a constant, not a new object).
 */
export function useKept<T>(slot: string, initial: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(subscribe, () => (kept.has(slot) ? (kept.get(slot) as T) : initial));
  const set = useCallback(
    (next: T) => {
      kept.set(slot, next);
      emit();
    },
    [slot],
  );
  return [value, set];
}

/** Everything unfinished belongs to whoever was signed in: none of it may outlast them. */
export function clearKeptWork() {
  for (const [key, job] of jobs) if (job.status === "done") disposers.get(key)?.(job.value);
  disposers.clear();
  jobs.clear();
  kept.clear();
  emit();
}

/** Names a file well enough to tell one pick from the next. */
export function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Drops every job whose key starts with `prefix` — all the work on one photo, say. */
export function forgetJobs(prefix: string) {
  for (const key of [...jobs.keys()]) if (key.startsWith(prefix)) forgetJob(key);
}
