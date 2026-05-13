import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PriorityBadge, StageBadge } from "@/components/PriorityBadge";
import { CommentForm } from "./CommentForm";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, module:module_id(name), category:category_id(name), submitter:submitter_id(full_name, email), poc:assigned_poc_id(full_name, email)")
    .eq("id", params.id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: comments }, { data: history }] = await Promise.all([
    supabase.from("comments")
      .select("id, body, created_at, is_internal, author:author_id(full_name, email)")
      .eq("ticket_id", params.id)
      .order("created_at"),
    supabase.from("ticket_history")
      .select("*")
      .eq("ticket_id", params.id)
      .order("changed_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-airtel-gray">{ticket.ticket_no}</div>
              <h1 className="text-xl font-semibold mt-1">{ticket.title}</h1>
            </div>
            <div className="flex gap-2">
              <PriorityBadge priority={ticket.priority} />
              <StageBadge stage={ticket.stage} />
            </div>
          </div>
          <p className="mt-4 text-sm whitespace-pre-wrap">{ticket.description}</p>
        </div>

        <div className="card p-5">
          <h2 className="font-medium mb-3">Comments</h2>
          <ul className="space-y-3">
            {(comments ?? []).map((c: any) => (
              <li key={c.id} className="border-l-2 border-airtel-red pl-3">
                <div className="text-xs text-airtel-gray">
                  {c.author?.full_name ?? c.author?.email} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                  {c.is_internal && <span className="ml-2 badge-red">internal</span>}
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
              </li>
            ))}
            {!comments?.length && <li className="text-sm text-airtel-gray">No comments yet.</li>}
          </ul>
          <div className="mt-4">
            <CommentForm ticketId={ticket.id} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-5 text-sm space-y-2">
          <Row k="Module" v={ticket.module?.name ?? "—"} />
          <Row k="Category" v={ticket.category?.name ?? "—"} />
          <Row k="Submitter" v={ticket.submitter?.full_name ?? ticket.submitter?.email ?? "—"} />
          <Row k="POC" v={ticket.poc?.full_name ?? ticket.poc?.email ?? "Unassigned"} />
          <Row k="People affected" v={ticket.people_affected ?? "—"} />
          <Row k="Hours lost/week" v={ticket.hours_lost_per_week ?? "—"} />
          <Row k="Cost saving (₹)" v={ticket.cost_saving_potential ?? "—"} />
          <Row k="Compliance risk" v={ticket.compliance_risk ? "Yes" : "No"} />
          <Row k="Resolution due" v={ticket.resolution_due_at ? new Date(ticket.resolution_due_at).toLocaleString() : "—"} />
        </div>

        <div className="card p-5">
          <h2 className="font-medium mb-3">History</h2>
          <ul className="space-y-2 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="text-airtel-gray">
                <span className="font-medium text-airtel-black">{h.field}</span>:{" "}
                {h.old_value ?? "—"} → {h.new_value ?? "—"}{" "}
                <span className="block text-xs">{new Date(h.changed_at).toLocaleString()}</span>
              </li>
            ))}
            {!history?.length && <li className="text-airtel-gray">No history yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-airtel-gray">{k}</span>
      <span className="text-airtel-black text-right">{v}</span>
    </div>
  );
}
