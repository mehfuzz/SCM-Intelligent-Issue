"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className="textarea"
        rows={3}
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="text-right">
        <button className="btn-primary" disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}
