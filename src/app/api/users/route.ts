import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const ROLES = [
  "submitter", "coe_analyst", "coe_admin", "poc_owner", "leadership", "system_admin"
] as const;

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  full_name: z.string().min(1),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  roles: z.array(z.enum(ROLES)).default(["submitter"]),
  send_invite: z.boolean().optional()  // if true and no password → send magic-link invite
});

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!isCoe(user.roles)) return err("Forbidden", 403);

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, employee_id, department, is_active, user_roles(role)")
    .eq("is_active", true)
    .order("full_name");
  if (error) return err(error.message, 500);

  const filtered = role
    ? (data ?? []).filter((u: any) => (u.user_roles ?? []).some((r: any) => r.role === role))
    : data;
  return ok(filtered);
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return err("Unauthorized", 401);
  if (!hasAnyRole(session.roles, ["system_admin"])) return err("Forbidden — admin only", 403);

  const parsed = CreateUserSchema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422, { issues: parsed.error.flatten() });
  const input = parsed.data;

  if (!input.password && !input.send_invite) {
    return err("Provide a password or set send_invite=true", 400);
  }

  const admin = createSupabaseAdminClient();

  // Create auth user (service-role). When a password is provided, mark email as
  // confirmed so the user can sign in immediately. Otherwise send an invite.
  let userId: string;
  if (input.password) {
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name }
    });
    if (error || !data.user) return err(error?.message ?? "Failed to create auth user", 500);
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name }
    });
    if (error || !data.user) return err(error?.message ?? "Failed to invite user", 500);
    userId = data.user.id;
  }

  // The handle_new_user() trigger inserts a profile + default submitter role.
  // Upsert the profile with full details and reset roles to the requested set.
  await admin.from("profiles").upsert({
    id: userId,
    email: input.email,
    full_name: input.full_name,
    employee_id: input.employee_id ?? null,
    department: input.department ?? null,
    is_active: true
  });

  await admin.from("user_roles").delete().eq("user_id", userId);
  if (input.roles.length) {
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert(input.roles.map((role) => ({ user_id: userId, role })));
    if (roleErr) return err(roleErr.message, 500);
  }

  await admin.from("audit_logs").insert({
    actor_id: session.id,
    entity_type: "user",
    entity_id: userId,
    action: "create",
    metadata: { email: input.email, roles: input.roles, invited: !input.password }
  });

  return ok(
    { id: userId, email: input.email, roles: input.roles, invited: !input.password },
    { status: 201 }
  );
}
