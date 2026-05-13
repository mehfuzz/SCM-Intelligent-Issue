import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, isCoe } from "@/lib/auth";
import { PriorityBadge, StageBadge } from "@/components/PriorityBadge";

export const dynamic = "force-dynamic";

export default async function CoeWorkbench() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isCoe(user.roles)) {
    return (
      <div className="card p-6 text-sm text-airtel-gray">
        You do not have COE access. Contact the system administrator if this is unexpected.
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [unassigned, p0, stalled] = await Promise.all([
    supabase.from("tickets")
      .select("id, ticket_no, title, stage, priority")
      .is("assigned_poc_id", null)
      .not("stage", "in", "(closed,rejected)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("tickets")
      .select("id, ticket_no, title, stage, priority")
      .in("priority", ["P0", "P1"])
      .not("stage", "in", "(closed,rejected)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("tickets")
      .select("id, ticket_no, title, stage, priority, resolution_due_at")
      .lte("resolution_due_at", new Date().toISOString())
      .not("stage", "in", "(closed,rejected)")
      .order("resolution_due_at")
      .limit(10)
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">COE Workbench</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Unassigned" data={unassigned.data ?? []} />
        <Section title="P0 / P1 Queue" data={p0.data ?? []} />
        <Section title="SLA Breached" data={stalled.data ?? []} />
      </div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-airtel-border text-sm font-medium">{title}</div>
      <ul className="divide-y divide-airtel-border">
        {data.map((t) => (
          <li key={t.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link className="font-medium truncate block" href={`/tickets/${t.id}`}>{t.ticket_no}</Link>
              <div className="text-airtel-gray truncate">{t.title}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <PriorityBadge priority={t.priority} />
              <StageBadge stage={t.stage} />
            </div>
          </li>
        ))}
        {!data.length && <li className="px-4 py-6 text-center text-airtel-gray text-sm">Nothing here.</li>}
      </ul>
    </div>
  );
}
