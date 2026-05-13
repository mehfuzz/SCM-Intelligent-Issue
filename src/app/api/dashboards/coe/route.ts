import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden", 403);
  const supabase = createSupabaseServerClient();

  const [open, unassigned, p0p1, stalled, reopened, pendingValidation] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).is("assigned_poc_id", null).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).in("priority", ["P0", "P1"]).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).lte("resolution_due_at", new Date().toISOString()).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("stage", "reopened"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("stage", "pending_validation")
  ]);

  const { data: byCategory } = await supabase
    .from("tickets")
    .select("category_id, priority")
    .not("stage", "in", "(closed,rejected)");

  return ok({
    counts: {
      open: open.count ?? 0,
      unassigned: unassigned.count ?? 0,
      p0_p1: p0p1.count ?? 0,
      breached: stalled.count ?? 0,
      reopened: reopened.count ?? 0,
      pending_validation: pendingValidation.count ?? 0
    },
    by_category: byCategory ?? []
  });
}
