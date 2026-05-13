import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ok, err } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (unreadOnly) q = q.eq("is_read", false);
  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body?.ids;
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", user.id);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return err(error.message, 500);
  return ok({ marked_read: true });
}
