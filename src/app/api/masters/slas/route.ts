import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const Schema = z.object({
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  response_minutes: z.number().int().positive(),
  resolution_minutes: z.number().int().positive()
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("sla_policies").select("*").order("priority");
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  if (!hasAnyRole(user.roles, ["system_admin", "coe_admin"])) return err("Forbidden", 403);

  const parsed = Schema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sla_policies")
    .upsert(parsed.data, { onConflict: "priority" })
    .select("*")
    .single();
  if (error) return err(error.message, 500);
  return ok(data);
}
