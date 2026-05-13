import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasAnyRole(user.roles, ["system_admin"])) {
    return (
      <div className="card p-6 text-sm text-airtel-gray">
        Admin access only.
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: modules }, { data: categories }, { data: slas }] = await Promise.all([
    supabase.from("modules").select("*").order("name"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("sla_policies").select("*").order("priority")
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Console</h1>
        <Link href="/admin/users" className="btn-primary">Manage users</Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ListCard title="Modules" rows={(modules ?? []).map((m) => m.name)} />
        <ListCard title="Categories" rows={(categories ?? []).map((c) => c.name)} />
        <ListCard
          title="SLA policies"
          rows={(slas ?? []).map((s) => `${s.priority}: ${s.response_minutes}m / ${s.resolution_minutes}m`)}
        />
      </div>

      <p className="text-xs text-airtel-gray">
        Mutation endpoints exist at <code>/api/masters/*</code> and{" "}
        <code>/api/users/[id]/roles</code>.
      </p>
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-airtel-border text-sm font-medium">{title}</div>
      <ul className="divide-y divide-airtel-border text-sm">
        {rows.map((r, i) => <li key={i} className="px-4 py-2">{r}</li>)}
        {!rows.length && <li className="px-4 py-6 text-center text-airtel-gray">Empty.</li>}
      </ul>
    </div>
  );
}
