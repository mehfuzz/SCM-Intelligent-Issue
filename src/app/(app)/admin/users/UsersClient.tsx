"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ALL_ROLES = [
  "submitter", "coe_analyst", "coe_admin", "poc_owner", "leadership", "system_admin"
] as const;

type Role = (typeof ALL_ROLES)[number];

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  employee_id: string | null;
  department: string | null;
  is_active: boolean;
  user_roles: { role: Role }[];
}

export function UsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    full_name: "",
    employee_id: "",
    department: "",
    password: "",
    send_invite: false,
    roles: ["submitter"] as Role[]
  });

  function toggleRole(role: Role) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role]
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    const body = {
      email: form.email,
      full_name: form.full_name,
      employee_id: form.employee_id || undefined,
      department: form.department || undefined,
      roles: form.roles,
      ...(form.send_invite
        ? { send_invite: true }
        : { password: form.password })
    };
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Failed to create user");
      return;
    }
    setMsg(`User ${form.email} created.`);
    setForm({
      email: "", full_name: "", employee_id: "", department: "",
      password: "", send_invite: false, roles: ["submitter"]
    });
    setShowForm(false);
    router.refresh();
  }

  async function resetRoles(userId: string, roles: Role[]) {
    await fetch(`/api/users/${userId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles })
    });
    setUsers((u) =>
      u.map((row) =>
        row.id === userId ? { ...row, user_roles: roles.map((role) => ({ role })) } : row
      )
    );
  }

  async function deactivate(userId: string) {
    if (!confirm("Deactivate this user?")) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ Add user"}
        </button>
      </div>

      {msg && <div className="card p-3 text-sm text-airtel-red">{msg}</div>}

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-airtel-gray mb-1">Full name *</label>
              <input className="input" required value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}/>
            </div>
            <div>
              <label className="block text-xs text-airtel-gray mb-1">Email *</label>
              <input className="input" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}/>
            </div>
            <div>
              <label className="block text-xs text-airtel-gray mb-1">Employee ID</label>
              <input className="input" value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}/>
            </div>
            <div>
              <label className="block text-xs text-airtel-gray mb-1">Department</label>
              <input className="input" value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}/>
            </div>
          </div>

          <div>
            <label className="block text-xs text-airtel-gray mb-1">Roles *</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const active = form.roles.includes(role);
                return (
                  <button type="button" key={role}
                    onClick={() => toggleRole(role)}
                    className={`badge cursor-pointer ${
                      active
                        ? "bg-airtel-red text-white"
                        : "bg-white text-airtel-gray border border-airtel-border"
                    }`}>
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.send_invite}
                onChange={(e) => setForm({ ...form, send_invite: e.target.checked, password: "" })}/>
              Send email invite instead of setting a password
            </label>
          </div>

          {!form.send_invite && (
            <div className="max-w-sm">
              <label className="block text-xs text-airtel-gray mb-1">Initial password *</label>
              <input className="input" type="text" minLength={8} required={!form.send_invite}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}/>
              <p className="text-xs text-airtel-gray mt-1">
                At least 8 chars. User can change it after first login.
              </p>
            </div>
          )}

          {err && <p className="text-sm text-airtel-red">{err}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !form.roles.length}>
              {busy ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Dept.</th><th>Roles</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name ?? "—"}</td>
                <td>{u.email}</td>
                <td>{u.department ?? "—"}</td>
                <td className="space-x-1">
                  {(u.user_roles ?? []).map((r) => (
                    <span key={r.role} className="badge-red">{r.role}</span>
                  ))}
                  {!u.user_roles?.length && <span className="text-airtel-gray">—</span>}
                </td>
                <td>
                  {u.is_active
                    ? <span className="badge-gray">active</span>
                    : <span className="badge-black">inactive</span>}
                </td>
                <td className="text-right">
                  <RoleEditor
                    current={(u.user_roles ?? []).map((r) => r.role)}
                    onSave={(roles) => resetRoles(u.id, roles)}
                  />
                  {u.is_active && (
                    <button className="btn-ghost text-xs ml-2" onClick={() => deactivate(u.id)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr><td colSpan={6} className="text-center py-8 text-airtel-gray">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleEditor({
  current, onSave
}: { current: Role[]; onSave: (roles: Role[]) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>(current);

  function toggle(r: Role) {
    setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  }

  if (!open) {
    return (
      <button className="btn-secondary text-xs" onClick={() => setOpen(true)}>Edit roles</button>
    );
  }

  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {ALL_ROLES.map((r) => (
        <button key={r} type="button" onClick={() => toggle(r)}
          className={`badge cursor-pointer ${
            roles.includes(r)
              ? "bg-airtel-red text-white"
              : "bg-white text-airtel-gray border border-airtel-border"
          }`}>
          {r}
        </button>
      ))}
      <button className="btn-primary text-xs ml-1"
        onClick={async () => { await onSave(roles); setOpen(false); }}>
        Save
      </button>
      <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}
