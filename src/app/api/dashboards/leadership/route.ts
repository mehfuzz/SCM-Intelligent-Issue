import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, hasAnyRole, isCoe } from "@/lib/auth";
import { ok, err } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles) && !hasAnyRole(user.roles, ["leadership"])) {
    return err("Forbidden", 403);
  }

  const supabase = createSupabaseServerClient();

  const [open, p0p1, closed, complianceOpen] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).in("priority", ["P0", "P1"]).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("stage", "closed"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("compliance_risk", true).not("stage", "in", "(closed,rejected)")
  ]);

  const { data: savings } = await supabase
    .from("tickets")
    .select("cost_saving_potential, hours_lost_per_week")
    .eq("stage", "closed");

  const totalSaving = (savings ?? []).reduce(
    (acc, t) => acc + Number(t.cost_saving_potential ?? 0),
    0
  );
  const totalHoursSaved = (savings ?? []).reduce(
    (acc, t) => acc + Number(t.hours_lost_per_week ?? 0),
    0
  );

  const { data: reopened } = await supabase
    .from("tickets")
    .select("reopen_count");
  const totalTickets = reopened?.length ?? 0;
  const reopenedCount = (reopened ?? []).filter((t) => (t.reopen_count ?? 0) > 0).length;
  const reopenRate = totalTickets ? (reopenedCount / totalTickets) * 100 : 0;

  const { data: byModule } = await supabase
    .from("tickets")
    .select("module_id")
    .not("stage", "in", "(closed,rejected)");

  return ok({
    kpis: {
      open: open.count ?? 0,
      p0_p1: p0p1.count ?? 0,
      closed: closed.count ?? 0,
      compliance_open: complianceOpen.count ?? 0,
      cost_saved: totalSaving,
      hours_saved: totalHoursSaved,
      reopen_rate_pct: Number(reopenRate.toFixed(2))
    },
    by_module: byModule ?? []
  });
}
