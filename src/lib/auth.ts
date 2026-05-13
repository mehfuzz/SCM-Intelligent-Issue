import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole =
  | "submitter"
  | "coe_analyst"
  | "coe_admin"
  | "poc_owner"
  | "leadership"
  | "system_admin";

export async function getSessionUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  return {
    id: user.id,
    email: user.email ?? "",
    roles: (roles ?? []).map((r) => r.role as AppRole)
  };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r));
}

export function isCoe(roles: AppRole[]) {
  return hasAnyRole(roles, ["coe_admin", "coe_analyst", "system_admin"]);
}
