import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  body: z.string().min(1).max(5000),
  is_internal: z.boolean().optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles:author_id(full_name, email)")
    .eq("ticket_id", params.id)
    .order("created_at");
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      ticket_id: params.id,
      author_id: user.id,
      body: parsed.data.body,
      is_internal: !!parsed.data.is_internal
    })
    .select("*")
    .single();

  if (error) return err(error.message, 500);
  return ok(data, { status: 201 });
}
