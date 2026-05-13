import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PriorityBadge, StageBadge } from "@/components/PriorityBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, ticket_no, title, stage, priority, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Dashboard</h1>
        <Link href="/tickets/new" className="btn-primary">+ Raise issue</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-airtel-border text-sm font-medium">
          Recent tickets
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th><th>Title</th><th>Priority</th><th>Stage</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(tickets ?? []).map((t) => (
              <tr key={t.id}>
                <td><Link className="font-medium" href={`/tickets/${t.id}`}>{t.ticket_no}</Link></td>
                <td>{t.title}</td>
                <td><PriorityBadge priority={t.priority} /></td>
                <td><StageBadge stage={t.stage} /></td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!tickets?.length && (
              <tr><td colSpan={5} className="text-center py-8 text-airtel-gray">No tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
