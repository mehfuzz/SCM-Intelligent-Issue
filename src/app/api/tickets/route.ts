import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";
import {
  computePriority,
  frequencyToScore,
  type PriorityConfig,
  type PriorityPopulation
} from "@/lib/priority";
import { computeDueDates } from "@/lib/sla";

const CreateTicketSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().min(5),
  module_id: z.string().uuid().nullable().optional(),
  function_id: z.string().uuid().nullable().optional(),
  function_team_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
  frequency: z.string().nullable().optional(),
  people_affected: z.number().int().nonnegative().nullable().optional(),
  hours_lost_per_week: z.number().nonnegative().nullable().optional(),
  cost_saving_potential: z.number().nonnegative().nullable().optional(),
  compliance_risk: z.boolean().optional(),
  suggested_solution: z.string().nullable().optional(),
  existing_workaround: z.string().nullable().optional()
});

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const priority = url.searchParams.get("priority");
  const module_id = url.searchParams.get("module_id");
  const category_id = url.searchParams.get("category_id");
  const q = url.searchParams.get("q");
  const mine = url.searchParams.get("mine");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("tickets")
    .select(
      "id, ticket_no, title, stage, priority, module_id, category_id, submitter_id, assigned_poc_id, created_at, resolution_due_at, compliance_risk"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (stage) query = query.eq("stage", stage);
  if (priority) query = query.eq("priority", priority);
  if (module_id) query = query.eq("module_id", module_id);
  if (category_id) query = query.eq("category_id", category_id);
  if (mine === "1") query = query.eq("submitter_id", user.id);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data, error } = await query;
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);

  const body = await readJson(req);
  const parsed = CreateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return err("Invalid payload", 422, { issues: parsed.error.flatten() });
  }
  const input = parsed.data;

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Compute initial priority using current active-tickets population
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

  const { combined_impact, priority, pct } = computePriority(
    {
      people_affected: input.people_affected ?? 0,
      frequency_score: frequencyToScore(input.frequency ?? null),
      hours_lost_per_week: input.hours_lost_per_week ?? 0,
      cost_saving_potential: input.cost_saving_potential ?? 0,
      compliance_risk: !!input.compliance_risk
    },
    population,
    config
  );

  const sla = (slaList ?? []).find((s) => s.priority === priority);
  const now = new Date();
  const due = sla
    ? computeDueDates(now, {
        priority,
        response_minutes: sla.response_minutes,
        resolution_minutes: sla.resolution_minutes
      })
    : null;

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      ...input,
      compliance_risk: !!input.compliance_risk,
      submitter_id: user.id,
      stage: "submitted",
      priority,
      impact_score: combined_impact,
      response_due_at: due?.response_due_at.toISOString() ?? null,
      resolution_due_at: due?.resolution_due_at.toISOString() ?? null
    })
    .select("*")
    .single();

  if (error) return err(error.message, 500);

  await admin.from("priority_scores").insert({
    ticket_id: ticket.id,
    pct_people: pct.people,
    pct_frequency: pct.frequency,
    pct_time_loss: pct.time_loss,
    pct_cost: pct.cost,
    combined_impact,
    priority
  });

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    entity_type: "ticket",
    entity_id: ticket.id,
    action: "create",
    metadata: { priority, impact_score: combined_impact }
  });

  // Acknowledgement notification (portal channel)
  await admin.from("notifications").insert({
    recipient_id: user.id,
    ticket_id: ticket.id,
    channel: "portal",
    subject: `Ticket ${ticket.ticket_no} created`,
    body: `Your issue "${ticket.title}" has been logged and assigned priority ${priority}.`
  });

  return ok(ticket, { status: 201 });
}
