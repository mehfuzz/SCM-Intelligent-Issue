import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1),
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, subcategories(*)")
    .order("sort_order");
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!hasAnyRole(user.roles, ["system_admin"])) return err("Forbidden", 403);
  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("categories").insert(parsed.data).select("*").single();
  if (error) return err(error.message, 500);
  return ok(data, { status: 201 });
}
