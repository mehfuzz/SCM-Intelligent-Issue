import type { Priority } from "@/lib/types";

export interface PriorityInputs {
  people_affected: number | null;
  frequency_score: number | null;       // 1..5 mapped from form dropdown
  hours_lost_per_week: number | null;
  cost_saving_potential: number | null;
  compliance_risk: boolean;
}

export interface PriorityPopulation {
  people_affected: number[];
  frequency_score: number[];
  hours_lost_per_week: number[];
  cost_saving_potential: number[];
}

export interface PriorityConfig {
  impact_weight: number;
  effort_weight: number;
  p1_min_score: number;
  p2_min_score: number;
}

function percentile(value: number | null, population: number[]): number {
  if (value === null || value === undefined || population.length === 0) return 0;
  const sorted = [...population].sort((a, b) => a - b);
  const below = sorted.filter((v) => v <= value).length;
  return (below / sorted.length) * 100;
}

export function frequencyToScore(frequency: string | null): number {
  switch ((frequency ?? "").toLowerCase()) {
    case "daily": return 5;
    case "weekly": return 4;
    case "monthly": return 3;
    case "quarterly": return 2;
    case "yearly":
    case "rarely": return 1;
    default: return 0;
  }
}

/**
 * Compute impact score, execution score, and priority band per BRD §3.
 * Compliance risk forces P0 and bypasses the score-based band.
 */
export function computePriority(
  inputs: PriorityInputs,
  population: PriorityPopulation,
  config: PriorityConfig,
  effortScore: number | null = null
): {
  combined_impact: number;
  execution_score: number | null;
  priority: Priority;
  pct: {
    people: number;
    frequency: number;
    time_loss: number;
    cost: number;
  };
} {
  const pct = {
    people: percentile(inputs.people_affected, population.people_affected),
    frequency: percentile(inputs.frequency_score, population.frequency_score),
    time_loss: percentile(inputs.hours_lost_per_week, population.hours_lost_per_week),
    cost: percentile(inputs.cost_saving_potential, population.cost_saving_potential)
  };

  const combined_impact =
    (pct.people + pct.frequency + pct.time_loss + pct.cost) * 0.25;

  // Effort score (1..5) — invert so low effort → higher executability
  const effortNormalised = effortScore ? ((6 - effortScore) / 5) * 100 : null;

  const execution_score = effortNormalised !== null
    ? combined_impact * config.impact_weight + effortNormalised * config.effort_weight
    : null;

  let priority: Priority;
  if (inputs.compliance_risk) {
    priority = "P0";
  } else if (combined_impact >= config.p1_min_score) {
    priority = "P1";
  } else if (combined_impact >= config.p2_min_score) {
    priority = "P2";
  } else {
    priority = "P3";
  }

  return { combined_impact, execution_score, priority, pct };
}
