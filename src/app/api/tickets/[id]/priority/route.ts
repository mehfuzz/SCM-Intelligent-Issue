import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";
import {
  computePriority,
  frequencyToScore,
  type PriorityConfig,
  type PriorityPopulation
} from "@/lib/priority";
import { computeDueDates } from "@/lib/sla";

const Schema = z.object({
  override_priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  coe_effort_score: z.number().int().min(1).max(5).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden — COE only", 403);

  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!ticket) return err("Not found", 404);

  const [{ data: pop }, { data: cfg }, { data: slaList }] = await Promise.all([
    admin
      .from("tickets")
      .select("people_affected, frequency, hours_lost_per_week, cost_saving_potential")
      .not("stage", "in", "(closed,rejected)"),
    admin.from("priority_config").select("*").maybeSingle(),
    admin.from("sla_policies").select("*")
  ]);

  const population: PriorityPopulation = {
    people_affected: (pop ?? []).map((r) => Number(r.people_affected ?? 0)),
    frequency_score: (pop ?? []).map((r) => frequencyToScore(r.frequency)),
    hours_lost_per_week: (pop ?? []).map((r) => Number(r.hours_lost_per_week ?? 0)),
    cost_saving_potential: (pop ?? []).map((r) => Number(r.cost_saving_potential ?? 0))
  };

  const config: PriorityConfig = {
    impact_weight: Number(cfg?.impact_weight ?? 0.7),
    effort_weight: Number(cfg?.effort_weight ?? 0.3),
    p1_min_score: Number(cfg?.p1_min_score ?? 85),
    p2_min_score: Number(cfg?.p2_min_score ?? 60)
  };

  const effort = parsed.data.coe_effort_score ?? ticket.coe_effort_score ?? null;

  const result = computePriority(
    {
      people_affected: ticket.people_affected ?? 0,
      frequency_score: frequencyToScore(ticket.frequency),
      hours_lost_per_week: Number(ticket.hours_lost_per_week ?? 0),
      cost_saving_potential: Number(ticket.cost_saving_potential ?? 0),
      compliance_risk: !!ticket.compliance_risk
    },
    population,
    config,
    effort
  );

  const finalPriority = parsed.data.override_priority ?? result.priority;
  const sla = (slaList ?? []).find((s) => s.priority === finalPriority);
  const due = sla
    ? computeDueDates(new Date(ticket.created_at), {
        priority: finalPriority,
        response_minutes: sla.response_minutes,
        resolution_minutes: sla.resolution_minutes
      })
    : null;

  const { data, error } = await supabase
    .from("tickets")
    .update({
      priority: finalPriority,
      impact_score: result.combined_impact,
      execution_score: result.execution_score,
      coe_effort_score: effort,
      response_due_at: due?.response_due_at.toISOString() ?? ticket.response_due_at,
      resolution_due_at: due?.resolution_due_at.toISOString() ?? ticket.resolution_due_at
    })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return err(error.message, 500);

  await admin.from("priority_scores").insert({
    ticket_id: params.id,
    pct_people: result.pct.people,
    pct_frequency: result.pct.frequency,
    pct_time_loss: result.pct.time_loss,
    pct_cost: result.pct.cost,
    combined_impact: result.combined_impact,
    effort_score: effort,
    execution_score: result.execution_score,
    priority: finalPriority
  });

  return ok(data);
}
