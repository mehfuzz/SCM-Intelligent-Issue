import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/http";

/**
 * Returns all master data in a single call (for the issue submission form).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const [
    modules,
    functions,
    function_teams,
    categories,
    subcategories,
    sla_policies,
    brd_templates,
    workflow_stages
  ] = await Promise.all([
    supabase.from("modules").select("*").eq("is_active", true).order("name"),
    supabase.from("functions").select("*").eq("is_active", true).order("name"),
    supabase.from("function_teams").select("*").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("subcategories").select("*").eq("is_active", true),
    supabase.from("sla_policies").select("*").order("priority"),
    supabase.from("brd_templates").select("*").eq("is_active", true),
    supabase.from("workflow_stages").select("*").order("sort_order")
  ]);

  const first = [
    modules, functions, function_teams, categories,
    subcategories, sla_policies, brd_templates, workflow_stages
  ].find((r) => r.error);
  if (first?.error) return err(first.error.message, 500);

  return ok({
    modules: modules.data ?? [],
    functions: functions.data ?? [],
    function_teams: function_teams.data ?? [],
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
    sla_policies: sla_policies.data ?? [],
    brd_templates: brd_templates.data ?? [],
    workflow_stages: workflow_stages.data ?? []
  });
}
