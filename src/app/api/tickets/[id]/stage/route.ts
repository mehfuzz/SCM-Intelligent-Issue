import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const STAGES = [
  "draft", "submitted", "coe_triage", "poc_assigned",
  "requirement_clarification", "brd_acceptance", "solution_design",
  "mih_ccb_approval", "development_sit", "uat", "go_live",
  "pending_validation", "closed", "reopened", "rejected"
] as const;

const Schema = z.object({
  stage: z.enum(STAGES),
  reason: z.string().optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);

  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Fetch current ticket
  const { data: existing } = await supabase
    .from("tickets")
    .select("id, submitter_id, assigned_poc_id, stage, reopen_count")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return err("Not found", 404);

  const submitter = existing.submitter_id === user.id;
  const assignee = existing.assigned_poc_id === user.id;
  const coe = isCoe(user.roles);

  // Permissions per role
  const target = parsed.data.stage;
  if (!coe) {
    // Submitter may only request reopen / accept validation transitions
    const submitterAllowed = ["reopened", "closed"];
    const assigneeAllowed = ["pending_validation", "development_sit", "uat", "go_live", "solution_design", "requirement_clarification", "brd_acceptance"];
    if (submitter && !submitterAllowed.includes(target)) return err("Forbidden", 403);
    if (assignee && !assigneeAllowed.includes(target)) return err("Forbidden", 403);
    if (!submitter && !assignee) return err("Forbidden", 403);
  }

  const updates: Record<string, unknown> = { stage: target };
  if (target === "reopened") {
    updates.reopen_count = (existing.reopen_count ?? 0) + 1;
    updates.closed_at = null;
    updates.resolved_at = null;
  }
  if (target === "closed") {
    updates.closed_at = new Date().toISOString();
  }
  if (target === "pending_validation") {
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return err(error.message, 500);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    entity_type: "ticket",
    entity_id: params.id,
    action: "stage_change",
    metadata: { from: existing.stage, to: target, reason: parsed.data.reason }
  });

  // Notify submitter & POC on stage change
  const recipients = [data.submitter_id, data.assigned_poc_id].filter(Boolean) as string[];
  if (recipients.length) {
    await admin.from("notifications").insert(
      recipients.map((r) => ({
        recipient_id: r,
        ticket_id: data.id,
        channel: "portal",
        subject: `Ticket ${data.ticket_no} moved to ${target}`,
        body: parsed.data.reason ?? ""
      }))
    );
  }

  return ok(data);
}
