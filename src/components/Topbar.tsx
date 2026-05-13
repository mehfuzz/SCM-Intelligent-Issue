"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function Topbar({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }
  return (
    <header className="flex h-14 items-center justify-between border-b border-airtel-border bg-white px-6">
      <div className="text-sm text-airtel-gray">
        SCM Issue Intelligence &amp; Workflow Management
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-airtel-black">{email}</span>
        <button onClick={logout} className="btn-secondary text-xs">
          Sign out
        </button>
      </div>
    </header>
  );
}
