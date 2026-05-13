import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser, isCoe } from "@/lib/auth";
import { ok, err, readJson } from "@/lib/http";

const UpdateSchema = z.object({
  content: z.record(z.unknown()).optional(),
  status: z.enum(["draft", "in_review", "approved", "locked"]).optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("brds")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Not found", 404);
  return ok(data);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);
  const parsed = UpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return err("Invalid payload", 422);

  if (parsed.data.status === "approved" && !isCoe(user.roles)) {
    return err("Only COE can approve a BRD", 403);
  }

  const supabase = createSupabaseServerClient();
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "approved") {
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("brds")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return err(error.message, 500);
  return ok(data);
}
