import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  roles: z.array(z.enum([
    "submitter", "coe_analyst", "coe_admin", "poc_owner", "leadership", "system_admin"
  ]))
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!hasAnyRole(user.roles, ["system_admin"])) return err("Forbidden", 403);
  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  await supabase.from("user_roles").delete().eq("user_id", params.id);
  if (parsed.data.roles.length) {
    const { error } = await supabase
      .from("user_roles")
      .insert(parsed.data.roles.map((role) => ({ user_id: params.id, role })));
    if (error) return err(error.message, 500);
  }
  return ok({ user_id: params.id, roles: parsed.data.roles });
}
