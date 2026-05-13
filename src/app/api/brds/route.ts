import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const CreateSchema = z.object({
  ticket_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
  content: z.record(z.unknown()).default({}),
  status: z.enum(["draft", "in_review", "approved", "locked"]).default("draft")
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticket_id = url.searchParams.get("ticket_id");
  const supabase = createSupabaseServerClient();
  let q = supabase.from("brds").select("*").order("version", { ascending: false });
  if (ticket_id) q = q.eq("ticket_id", ticket_id);
  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);

  const parsed = CreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();

  // Find next version for this ticket
  const { data: existing } = await supabase
    .from("brds")
    .select("version")
    .eq("ticket_id", parsed.data.ticket_id)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  // If no template provided, attempt to pick the template that matches ticket category
  let templateId = parsed.data.template_id ?? null;
  if (!templateId) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("category_id")
      .eq("id", parsed.data.ticket_id)
      .maybeSingle();
    if (ticket?.category_id) {
      const { data: tmpl } = await supabase
        .from("brd_templates")
        .select("id")
        .eq("category_id", ticket.category_id)
        .eq("is_active", true)
        .maybeSingle();
      templateId = tmpl?.id ?? null;
    }
  }

  const { data, error } = await supabase
    .from("brds")
    .insert({
      ticket_id: parsed.data.ticket_id,
      template_id: templateId,
      version: nextVersion,
      status: parsed.data.status,
      content: parsed.data.content,
      created_by: user.id
    })
    .select("*")
    .single();
  if (error) return err(error.message, 500);
  return ok(data, { status: 201 });
}
