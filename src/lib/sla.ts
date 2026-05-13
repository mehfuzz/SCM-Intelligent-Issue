import type { Priority } from "@/lib/types";

export interface SlaPolicy {
  priority: Priority;
  response_minutes: number;
  resolution_minutes: number;
}

export function computeDueDates(from: Date, policy: SlaPolicy) {
  const response_due_at = new Date(from.getTime() + policy.response_minutes * 60_000);
  const resolution_due_at = new Date(from.getTime() + policy.resolution_minutes * 60_000);
  return { response_due_at, resolution_due_at };
}

export function slaConsumedPct(start: Date, due: Date, now: Date = new Date()): number {
  const total = due.getTime() - start.getTime();
  if (total <= 0) return 100;
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

export function thresholdsCrossed(prevPct: number, currPct: number): number[] {
  const thresholds = [50, 75, 100];
  return thresholds.filter((t) => prevPct < t && currPct >= t);
}
