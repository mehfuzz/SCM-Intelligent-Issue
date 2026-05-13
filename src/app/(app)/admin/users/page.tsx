import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
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
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, employee_id, department, is_active, user_roles(role)")
    .order("full_name");

  return <UsersClient initialUsers={data ?? []} />;
}
