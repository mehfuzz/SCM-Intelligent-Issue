"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // router.refresh() wipes Next's RSC cache so the (app) layout
    // re-runs getSessionUser() with the new session cookies — otherwise
    // the Topbar can render with a stale identity from the previous user.
    router.replace(next);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="block text-xs font-medium text-airtel-gray mb-1">Email</label>
        <input className="input" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-airtel-gray mb-1">Password</label>
        <input className="input" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-airtel-red">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-airtel-surface">
      <div className="w-full max-w-sm card p-8">
        <div className="flex justify-center mb-6">
          <Brand size="lg" />
        </div>
        <h1 className="text-lg font-semibold text-airtel-black mb-1">Sign in</h1>
        <p className="text-sm text-airtel-gray mb-6">
          Use your Airtel SCM credentials to continue.
        </p>
        <Suspense fallback={<div className="text-sm text-airtel-gray">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
