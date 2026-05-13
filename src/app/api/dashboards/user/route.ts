import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ok, err } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const supabase = createSupabaseServerClient();

  const [open, validation, closed] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true })
      .eq("submitter_id", user.id)
      .not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true })
      .eq("submitter_id", user.id)
      .eq("stage", "pending_validation"),
    supabase.from("tickets").select("id", { count: "exact", head: true })
      .eq("submitter_id", user.id)
      .eq("stage", "closed")
  ]);

  const { data: recent } = await supabase
    .from("tickets")
    .select("id, ticket_no, title, stage, priority, resolution_due_at, created_at")
    .eq("submitter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return ok({
    counts: {
      open: open.count ?? 0,
      pending_validation: validation.count ?? 0,
      closed: closed.count ?? 0
    },
    recent: recent ?? []
  });
}
