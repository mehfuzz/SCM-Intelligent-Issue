import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, err } from "@/lib/http";
import { slaConsumedPct } from "@/lib/sla";

/**
 * SLA scanner — designed to be invoked by a Vercel Cron job.
 * Walks all open tickets, computes SLA consumption, and emits
 * reminder / escalation / breach events + notifications.
 *
 * Authentication: expects header `x-cron-secret` matching env CRON_SECRET.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return err("Forbidden", 403);
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: tickets, error } = await admin
    .from("tickets")
    .select("id, ticket_no, title, created_at, resolution_due_at, submitter_id, assigned_poc_id, stage")
    .not("stage", "in", "(closed,rejected)")
    .not("resolution_due_at", "is", null);
  if (error) return err(error.message, 500);

  const events: any[] = [];
  const notifications: any[] = [];

  for (const t of tickets ?? []) {
    const start = new Date(t.created_at);
    const due = new Date(t.resolution_due_at!);
    const pct = slaConsumedPct(start, due, now);

    const { data: priorEvents } = await admin
      .from("sla_events")
      .select("kind, threshold_pct")
      .eq("ticket_id", t.id);

    const fired = new Set((priorEvents ?? []).map((e) => `${e.kind}:${e.threshold_pct}`));

    const checks: { kind: "reminder" | "warning" | "escalation" | "breach"; threshold: number }[] = [
      { kind: "reminder", threshold: 50 },
      { kind: "warning", threshold: 75 },
      { kind: "breach", threshold: 100 }
    ];

    for (const c of checks) {
      if (pct >= c.threshold && !fired.has(`${c.kind}:${c.threshold}`)) {
        events.push({
          ticket_id: t.id,
          kind: c.kind,
          threshold_pct: c.threshold,
          notes: `SLA ${pct.toFixed(0)}% consumed`
        });
        const recipients = [t.submitter_id, t.assigned_poc_id].filter(Boolean) as string[];
        for (const r of recipients) {
          notifications.push({
            recipient_id: r,
            ticket_id: t.id,
            channel: "portal",
            subject: `[${c.kind.toUpperCase()}] ${t.ticket_no} — SLA ${c.threshold}% consumed`,
            body: t.title
          });
        }
      }
    }
  }

  if (events.length) await admin.from("sla_events").insert(events);
  if (notifications.length) await admin.from("notifications").insert(notifications);

  return ok({ scanned: tickets?.length ?? 0, events_fired: events.length });
}
