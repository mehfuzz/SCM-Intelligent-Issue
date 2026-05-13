import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar email={user.email} />
        <main className="flex-1 p-6 bg-airtel-surface">{children}</main>
      </div>
    </div>
  );
}
