import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PriorityBadge, StageBadge } from "@/components/PriorityBadge";

export const dynamic = "force-dynamic";

export default async function TicketsPage({
  searchParams
}: { searchParams: { q?: string; mine?: string; stage?: string } }) {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("tickets")
    .select("id, ticket_no, title, stage, priority, created_at, resolution_due_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (searchParams.q) q = q.ilike("title", `%${searchParams.q}%`);
  if (searchParams.stage) q = q.eq("stage", searchParams.stage);
  const { data: tickets } = await q;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tickets</h1>
        <Link href="/tickets/new" className="btn-primary">+ Raise issue</Link>
      </div>

      <form className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-airtel-gray mb-1">Search title</label>
          <input className="input" name="q" defaultValue={searchParams.q ?? ""} placeholder="e.g. PO approval delay"/>
        </div>
        <div>
          <label className="block text-xs text-airtel-gray mb-1">Stage</label>
          <select className="select" name="stage" defaultValue={searchParams.stage ?? ""}>
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="coe_triage">COE Triage</option>
            <option value="poc_assigned">POC Assigned</option>
            <option value="development_sit">Development &amp; SIT</option>
            <option value="uat">UAT</option>
            <option value="pending_validation">Pending Validation</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button className="btn-primary">Filter</button>
      </form>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Stage</th><th>SLA due</th></tr>
          </thead>
          <tbody>
            {(tickets ?? []).map((t) => (
              <tr key={t.id}>
                <td><Link className="font-medium" href={`/tickets/${t.id}`}>{t.ticket_no}</Link></td>
                <td>{t.title}</td>
                <td><PriorityBadge priority={t.priority} /></td>
                <td><StageBadge stage={t.stage} /></td>
                <td className="text-airtel-gray">
                  {t.resolution_due_at ? new Date(t.resolution_due_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {!tickets?.length && (
              <tr><td colSpan={5} className="text-center py-8 text-airtel-gray">No tickets match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
