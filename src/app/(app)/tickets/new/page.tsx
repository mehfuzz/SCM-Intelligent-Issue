"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Master {
  modules: { id: string; name: string }[];
  functions: { id: string; name: string; module_id: string }[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
}

export default function NewTicketPage() {
  const router = useRouter();
  const [masters, setMasters] = useState<Master | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    module_id: "",
    function_id: "",
    category_id: "",
    subcategory_id: "",
    frequency: "Monthly",
    people_affected: 0,
    hours_lost_per_week: 0,
    cost_saving_potential: 0,
    compliance_risk: false,
    suggested_solution: "",
    existing_workaround: ""
  });

  useEffect(() => {
    fetch("/api/masters")
      .then((r) => r.json())
      .then((j) => setMasters(j.data));
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      ...form,
      module_id: form.module_id || null,
      function_id: form.function_id || null,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null
    };
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to submit");
      return;
    }
    const { data } = await res.json();
    router.push(`/tickets/${data.id}`);
  }

  const filteredFunctions = masters?.functions.filter((f) => f.module_id === form.module_id) ?? [];
  const filteredSubcats = masters?.subcategories.filter((s) => s.category_id === form.category_id) ?? [];

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold">Raise an issue</h1>

      <section className="card p-5 space-y-4">
        <h2 className="font-medium">Basic information</h2>
        <div>
          <label className="block text-xs text-airtel-gray mb-1">Issue title *</label>
          <input className="input" required value={form.title}
            onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Module *</label>
            <select className="select" required value={form.module_id}
              onChange={(e) => { set("module_id", e.target.value); set("function_id", ""); }}>
              <option value="">Select…</option>
              {masters?.modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Function</label>
            <select className="select" value={form.function_id}
              onChange={(e) => set("function_id", e.target.value)}>
              <option value="">Select…</option>
              {filteredFunctions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Category *</label>
            <select className="select" required value={form.category_id}
              onChange={(e) => { set("category_id", e.target.value); set("subcategory_id", ""); }}>
              <option value="">Select…</option>
              {masters?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Subcategory</label>
            <select className="select" value={form.subcategory_id}
              onChange={(e) => set("subcategory_id", e.target.value)}>
              <option value="">Select…</option>
              {filteredSubcats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-airtel-gray mb-1">Description *</label>
          <textarea className="textarea" rows={5} required value={form.description}
            onChange={(e) => set("description", e.target.value)} />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-medium">Impact assessment</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Frequency</label>
            <select className="select" value={form.frequency}
              onChange={(e) => set("frequency", e.target.value)}>
              <option>Daily</option><option>Weekly</option><option>Monthly</option>
              <option>Quarterly</option><option>Yearly</option><option>Rarely</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">People affected</label>
            <input type="number" className="input" min={0} value={form.people_affected}
              onChange={(e) => set("people_affected", Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Hours lost / week</label>
            <input type="number" step="0.5" className="input" min={0} value={form.hours_lost_per_week}
              onChange={(e) => set("hours_lost_per_week", Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-airtel-gray mb-1">Cost saving potential (₹)</label>
            <input type="number" className="input" min={0} value={form.cost_saving_potential}
              onChange={(e) => set("cost_saving_potential", Number(e.target.value))} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.compliance_risk}
            onChange={(e) => set("compliance_risk", e.target.checked)} />
          This issue has compliance / audit risk (auto-assigns P0)
        </label>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-medium">Additional context</h2>
        <div>
          <label className="block text-xs text-airtel-gray mb-1">Suggested solution</label>
          <textarea className="textarea" rows={3} value={form.suggested_solution}
            onChange={(e) => set("suggested_solution", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-airtel-gray mb-1">Existing workaround</label>
          <textarea className="textarea" rows={3} value={form.existing_workaround}
            onChange={(e) => set("existing_workaround", e.target.value)} />
        </div>
      </section>

      {error && <p className="text-sm text-airtel-red">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={() => history.back()}>Cancel</button>
        <button className="btn-primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit issue"}
        </button>
      </div>
    </form>
  );
}
