import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function recordAudit(params: {
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: params.actor_id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    metadata: params.metadata ?? {}
  });
}
