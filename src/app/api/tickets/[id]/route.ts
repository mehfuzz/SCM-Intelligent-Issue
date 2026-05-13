import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const UpdateSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  description: z.string().optional(),
  stage: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  assigned_poc_id: z.string().uuid().nullable().optional(),
  coe_effort_score: z.number().int().min(1).max(5).optional(),
  jira_ticket_id: z.string().nullable().optional(),
  jira_status: z.string().nullable().optional(),
  jira_owner: z.string().nullable().optional(),
  jira_url: z.string().url().nullable().optional(),
  suggested_solution: z.string().nullable().optional(),
  existing_workaround: z.string().nullable().optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const supabase = createSupabaseServerClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return err(error.message, 500);
  if (!ticket) return err("Not found", 404);

  const [history, comments, attachments, brds, links] = await Promise.all([
    supabase.from("ticket_history").select("*").eq("ticket_id", ticket.id).order("changed_at", { ascending: false }),
    supabase.from("comments").select("*").eq("ticket_id", ticket.id).order("created_at"),
    supabase.from("attachments").select("*").eq("ticket_id", ticket.id),
    supabase.from("brds").select("*").eq("ticket_id", ticket.id).order("version", { ascending: false }),
    supabase.from("ticket_links").select("*").eq("ticket_id", ticket.id)
  ]);

  return ok({
    ticket,
    history: history.data ?? [],
    comments: comments.data ?? [],
    attachments: attachments.data ?? [],
    brds: brds.data ?? [],
    links: links.data ?? []
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const body = await readJson(req);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return err("Invalid payload", 422, { issues: parsed.error.flatten() });

  // Sensitive fields restricted to COE
  const coe = isCoe(user.roles);
  const restricted = ["priority", "assigned_poc_id", "coe_effort_score", "stage"] as const;
  for (const f of restricted) {
    if (parsed.data[f] !== undefined && !coe) {
      return err(`Only COE can modify ${f}`, 403);
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tickets")
    .update(parsed.data)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return err(error.message, 500);

  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    entity_type: "ticket",
    entity_id: params.id,
    action: "update",
    metadata: parsed.data
  });

  return ok(data);
}
