import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const UpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  employee_id: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUser();
  if (!session) return err("Unauthorized", 401);
  if (!hasAnyRole(session.roles, ["system_admin"])) return err("Forbidden", 403);

  const parsed = UpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const admin = createSupabaseAdminClient();
  const { password, ...profile } = parsed.data;

  if (Object.keys(profile).length) {
    const { error } = await admin.from("profiles").update(profile).eq("id", params.id);
    if (error) return err(error.message, 500);
  }
  if (password) {
    const { error } = await admin.auth.admin.updateUserById(params.id, { password });
    if (error) return err(error.message, 500);
  }

  await admin.from("audit_logs").insert({
    actor_id: session.id,
    entity_type: "user",
    entity_id: params.id,
    action: "update",
    metadata: { password_reset: !!password, ...profile }
  });

  return ok({ id: params.id, ...profile });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUser();
  if (!session) return err("Unauthorized", 401);
  if (!hasAnyRole(session.roles, ["system_admin"])) return err("Forbidden", 403);
  if (session.id === params.id) return err("Cannot deactivate yourself", 400);

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", params.id);
  if (error) return err(error.message, 500);

  await admin.from("audit_logs").insert({
    actor_id: session.id,
    entity_type: "user",
    entity_id: params.id,
    action: "deactivate"
  });

  return ok({ id: params.id, is_active: false });
}
