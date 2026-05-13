import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LeadershipPage() {
  const supabase = createSupabaseServerClient();

  const [{ count: open }, { count: p0 }, { count: closed }, { count: compliance }] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).in("priority", ["P0", "P1"]).not("stage", "in", "(closed,rejected)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("stage", "closed"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("compliance_risk", true).not("stage", "in", "(closed,rejected)")
  ]);

  const { data: savings } = await supabase
    .from("tickets")
    .select("cost_saving_potential")
    .eq("stage", "closed");
  const totalSaving = (savings ?? []).reduce((a, t) => a + Number(t.cost_saving_potential ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Leadership Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Open issues" value={open ?? 0} />
        <Kpi label="P0 / P1 open" value={p0 ?? 0} accent />
        <Kpi label="Closed" value={closed ?? 0} />
        <Kpi label="Compliance open" value={compliance ?? 0} accent />
        <Kpi label="Cost saved (₹)" value={totalSaving.toLocaleString("en-IN")} />
      </div>
      <p className="text-xs text-airtel-gray">
        Trend, module heatmap, and resolution velocity charts will be plugged into this view in Phase 2.
      </p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-airtel-red" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-airtel-gray">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent ? "text-airtel-red" : "text-airtel-black"}`}>{value}</div>
    </div>
  );
}
