import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  assigned_poc_id: z.string().uuid().nullable()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden — COE only", 403);

  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("tickets")
    .update({
      assigned_poc_id: parsed.data.assigned_poc_id,
      stage: parsed.data.assigned_poc_id ? "poc_assigned" : "coe_triage"
    })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return err(error.message, 500);

  if (parsed.data.assigned_poc_id) {
    await admin.from("notifications").insert({
      recipient_id: parsed.data.assigned_poc_id,
      ticket_id: params.id,
      channel: "portal",
      subject: `Ticket ${data.ticket_no} assigned to you`,
      body: `You have been assigned as POC for "${data.title}".`
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    entity_type: "ticket",
    entity_id: params.id,
    action: "assign",
    metadata: { assigned_poc_id: parsed.data.assigned_poc_id }
  });

  return ok(data);
}
