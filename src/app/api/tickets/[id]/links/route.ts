import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  linked_ticket_id: z.string().uuid(),
  link_type: z.enum(["duplicate", "related", "parent_child"]),
  notes: z.string().optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ticket_links")
    .select("*, linked:linked_ticket_id(ticket_no, title, priority, stage)")
    .eq("ticket_id", params.id);
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden — COE only", 403);

  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);
  if (parsed.data.linked_ticket_id === params.id) return err("Cannot link a ticket to itself", 400);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ticket_links")
    .insert({
      ticket_id: params.id,
      linked_ticket_id: parsed.data.linked_ticket_id,
      link_type: parsed.data.link_type,
      notes: parsed.data.notes,
      created_by: user.id
    })
    .select("*")
    .single();
  if (error) return err(error.message, 500);

  // If duplicate -> parent linkage, bump duplicate_count on parent
  if (parsed.data.link_type === "parent_child" || parsed.data.link_type === "duplicate") {
    await supabase.rpc("noop").catch(() => {}); // placeholder if you add an RPC
    await supabase
      .from("tickets")
      .update({ parent_ticket_id: parsed.data.linked_ticket_id })
      .eq("id", params.id);
    await supabase
      .from("tickets")
      .update({
        duplicate_count: 1
      })
      .eq("id", parsed.data.linked_ticket_id);
  }

  return ok(data, { status: 201 });
}
