import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden", 403);

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, employee_id, department, is_active, user_roles(role)")
    .eq("is_active", true)
    .order("full_name");
  const { data, error } = await query;
  if (error) return err(error.message, 500);

  const filtered = role
    ? (data ?? []).filter((u: any) => (u.user_roles ?? []).some((r: any) => r.role === role))
    : data;
  return ok(filtered);
}
