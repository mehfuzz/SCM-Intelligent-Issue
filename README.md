# SCM Issue Intelligence & Workflow Management Portal

Phase 1 (no AI) backend + minimal UI for the Airtel SCM COE.
Built as a serverless Next.js App Router project on Vercel with Supabase
(Postgres + Auth + Storage).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + Tailwind |
| API | Next.js Route Handlers (Vercel serverless functions) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password, SSO-ready) |
| File storage | Supabase Storage (`ticket-attachments` bucket) |
| Cron | Vercel Cron → `/api/sla/scan` every 15 min |
| Theme | Airtel — minimalist white & red |

The AI modules from the BRD (form assistant, deduplication, BRD draft
generation, auto category detection) are deliberately deferred. The
schema includes a `tickets.embedding_vector` placeholder so they can be
plugged in later without migration churn.

## Project layout

```
src/
  app/
    (app)/                     # authenticated pages (sidebar + topbar)
      dashboard/
      tickets/
        new/
        [id]/
      coe/                     # COE workbench
      leadership/              # KPIs
      admin/                   # masters & roles
    api/
      tickets/                 # CRUD + sub-resources
      brds/
      masters/
      users/
      dashboards/
      notifications/
      sla/scan/                # cron endpoint
      auth/callback/
    login/
  components/
  lib/
    supabase/   { server, client, admin }
    auth.ts     session + role helpers
    priority.ts percentile / impact / execution score calc (BRD §3)
    sla.ts      due-date + consumption helpers
    http.ts     JSON helpers
supabase/
  migrations/0001_init.sql     full schema + RLS + triggers
  seed.sql                     master data (categories, SLAs, modules…)
```

## Local setup

1. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (any random string; gates the SLA scanner)

2. In your Supabase project:
   - Run `supabase/migrations/0001_init.sql` in the SQL editor.
   - Run `supabase/seed.sql` to populate masters.
   - Create a public storage bucket named `ticket-attachments`
     (or change `BUCKET` in `src/app/api/tickets/[id]/attachments/route.ts`).

3. `npm install && npm run dev` → http://localhost:3000

## Deploy to Vercel (with Supabase)

End-to-end, ~15 minutes.

### Step 1 — Create the Supabase project

1. Go to https://supabase.com → **New project**.
2. Choose a region close to Airtel users (e.g. `ap-south-1 / Mumbai`).
3. Set a strong DB password and save it in a password manager.
4. Wait ~2 min for provisioning.

### Step 2 — Run the schema and seed

1. In the Supabase project: **SQL editor → + New query**.
2. Paste the entire contents of `supabase/migrations/0001_init.sql` →
   **Run**. You should see "Success. No rows returned."
3. New query → paste `supabase/seed.sql` → **Run**. This populates
   categories, SLA policies, workflow stages, BRD templates, and
   example modules.

### Step 3 — Create the storage bucket

1. **Storage → New bucket**.
2. Name: `ticket-attachments`. Toggle **Public bucket** → ON
   (or leave private and swap to signed URLs in
   `src/app/api/tickets/[id]/attachments/route.ts`).
3. Set file size limit to **25 MB** to match the API guard.

### Step 4 — Collect the Supabase credentials

In **Project Settings → API**, copy:

| Field | Env var |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon / public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role key (under "Project API keys") | `SUPABASE_SERVICE_ROLE_KEY` |

Keep `service_role` secret — it bypasses RLS and is used only by
server-side routes (SLA cron, user creation, audit writes).

### Step 5 — Push the repo to GitHub

```bash
git remote add origin git@github.com:<your-org>/scm-intelligent-issue.git
git push -u origin main   # or your default branch
```

### Step 6 — Import the project in Vercel

1. https://vercel.com/new → **Import Git Repository** → pick the repo.
2. **Framework Preset**: Next.js (auto-detected).
3. **Root Directory**: `/` (leave default).
4. **Build Command / Output**: leave as Vercel defaults
   (`next build` / `.next`).

### Step 7 — Set environment variables in Vercel

In the import screen (or later in **Project → Settings → Environment Variables**), add the following — make sure each one is enabled for
**Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon key>
SUPABASE_SERVICE_ROLE_KEY       = <service_role key>
NEXT_PUBLIC_APP_URL             = https://<your-project>.vercel.app
CRON_SECRET                     = <random 32+ char string>
```

`CRON_SECRET` gates `/api/sla/scan`. Generate one with
`openssl rand -hex 32`.

Click **Deploy**. First build takes ~2 minutes.

### Step 8 — Tell Supabase about the Vercel URL

Auth callbacks need to know the deployed origin.

1. Supabase → **Authentication → URL configuration**.
2. **Site URL**: `https://<your-project>.vercel.app`
3. **Redirect URLs** (add both):
   - `https://<your-project>.vercel.app/api/auth/callback`
   - `https://<your-project>.vercel.app/**` (for password-reset, magic
     link, etc.)
4. Save. If you also use a custom domain, add its origin and
   `*/api/auth/callback` here too.

### Step 9 — Wire the SLA cron secret

The cron in `vercel.json` already calls `/api/sla/scan` every 15
minutes, but the route requires the `x-cron-secret` header (see
`src/app/api/sla/scan/route.ts`).

Vercel's built-in cron uses `Authorization: Bearer <CRON_SECRET>`
instead of a custom header. Pick one of these to keep them aligned:

- **Easiest:** change the guard in `route.ts` to accept Vercel's bearer
  token:
  ```ts
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return err("Forbidden", 403);
  ```
  Vercel automatically injects this header for cron invocations once
  `CRON_SECRET` is set.

- **Or** trigger the scan from an external scheduler (cron-job.org,
  Upstash QStash, GitHub Actions) and have it POST with the existing
  `x-cron-secret: $CRON_SECRET` header.

### Step 10 — Create the first admin user

Follow **"Creating the first admin user"** below — promote one Supabase
auth user to `system_admin` via SQL. After that, log in and use
**Admin → Manage users** to add everyone else.

### Step 11 — Smoke test

- Visit `https://<your-project>.vercel.app/api/health` → returns
  `{"status":"ok"}`.
- Sign in at `/login`, raise a test issue, confirm a notification
  appears under your account, and verify a row landed in `tickets` in
  the Supabase table editor.

### Branch previews

Every PR you push gets its own preview URL. Add each preview origin
(or a `*.vercel.app` wildcard) to Supabase **Redirect URLs** so OAuth
flows still work on previews. The anon key is the same across
environments; the service-role key only ever lives in Vercel env vars
(never in client code).

### Pushing schema changes later

Treat `supabase/migrations/*.sql` as the source of truth. For each new
change:

1. Add a new file `0002_*.sql`.
2. Run it in Supabase SQL editor (or via `supabase db push` if you set
   up the Supabase CLI).
3. Commit; Vercel redeploys automatically.

## Creating the first admin user

Auth is handled by Supabase. New sign-ups land as `submitter` (via the
`handle_new_user()` trigger). The very first `system_admin` has to be
promoted manually — after that, the admin can create all other users
from the UI.

### Option A — Supabase Dashboard (recommended)

1. In your Supabase project, go to **Authentication → Users → Add user**.
2. Choose **Create new user**, enter the admin email and password, and tick
   *Auto-confirm user* so they can sign in right away.
3. Copy the new user's UUID from the table, then open **SQL editor** and
   run:
   ```sql
   -- replace with the actual UUID
   insert into user_roles (user_id, role)
   values ('00000000-0000-0000-0000-000000000000', 'system_admin')
   on conflict do nothing;

   update profiles
   set full_name = 'SCM Admin', department = 'COE'
   where id = '00000000-0000-0000-0000-000000000000';
   ```
4. Sign in to the portal at `/login` with that email/password. The
   "Admin" item in the sidebar is now enabled — open **Admin → Manage
   users** to add the rest of the team.

### Option B — Promote by email (one SQL block)

If you'd rather not look up the UUID:

```sql
insert into user_roles (user_id, role)
select id, 'system_admin' from auth.users where email = 'admin@airtel.in'
on conflict do nothing;
```

### Option C — Local dev with the Supabase CLI

```bash
# create the user (password 'ChangeMe123!')
supabase auth admin create-user --email admin@airtel.in --password 'ChangeMe123!' --confirm

# grant admin role
psql "$SUPABASE_DB_URL" -c "
  insert into user_roles (user_id, role)
  select id, 'system_admin' from auth.users where email='admin@airtel.in'
  on conflict do nothing;"
```

### Adding more users (any role) from the UI

Once you're signed in as `system_admin`:

1. Sidebar → **Admin** → **Manage users** → **+ Add user**.
2. Fill in name, email, department, employee ID.
3. Pick one or more roles by clicking the pills (any of:
   `submitter`, `coe_analyst`, `coe_admin`, `poc_owner`, `leadership`,
   `system_admin`).
4. Either set an initial password (minimum 8 chars) or tick
   **Send email invite** to have Supabase send a magic-link.
5. Submit. The new user can sign in immediately (password flow) or after
   accepting the invite (magic-link flow). Use the **Edit roles**
   button in the table to change roles later, or **Deactivate** to
   disable access without deleting history.

Under the hood this calls `POST /api/users` which uses the Supabase
service-role key (server-side only) to call
`auth.admin.createUser` / `inviteUserByEmail`, then writes the profile
and role rows. Only `system_admin` callers are accepted — the route
guard rejects everyone else with `403`.

## Role matrix (per BRD §3.2)

| Role | Capabilities |
|---|---|
| `submitter` | Raise tickets, comment, accept/reject resolution |
| `coe_analyst` | Read all, comment, light triage |
| `coe_admin` | Assign POC, change priority, modify SLA, override stage |
| `poc_owner` | Update assigned tickets, advance sub-stages, upload evidence |
| `leadership` | Read-only dashboard access |
| `system_admin` | Full master-data and role management |

Roles are enforced by Postgres RLS (see `supabase/migrations/0001_init.sql`)
*and* by API-route guards. New auth signups default to `submitter` via the
`handle_new_user()` trigger.

## API quick reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/masters` | All form masters in one call |
| `POST` | `/api/tickets` | Create ticket (auto-priority + SLA) |
| `GET` | `/api/tickets` | List (filters: `mine`, `stage`, `priority`, `q`) |
| `GET` | `/api/tickets/:id` | Detail bundle (ticket + comments + history + BRDs) |
| `PATCH` | `/api/tickets/:id` | Edit ticket fields |
| `POST` | `/api/tickets/:id/comments` | Add comment |
| `POST` | `/api/tickets/:id/attachments` | Upload file (multipart) |
| `POST` | `/api/tickets/:id/assign` | Assign POC (COE only) |
| `POST` | `/api/tickets/:id/stage` | Advance / reopen / close |
| `POST` | `/api/tickets/:id/priority` | Recompute priority + effort weighting |
| `POST` | `/api/tickets/:id/links` | Mark duplicate / related / parent-child |
| `GET/POST` | `/api/brds` | List / create new BRD version |
| `PATCH` | `/api/brds/:id` | Edit / submit / approve BRD |
| `GET` | `/api/users` | List active users (COE+) |
| `POST` | `/api/users` | Create user + assign roles (admin only) |
| `PATCH` | `/api/users/:id` | Update profile / reset password (admin only) |
| `DELETE` | `/api/users/:id` | Deactivate user (admin only) |
| `PUT` | `/api/users/:id/roles` | Replace user's role set (admin only) |
| `GET` | `/api/dashboards/{user,coe,leadership}` | Dashboard counts |
| `GET/PATCH` | `/api/notifications` | List / mark-read |
| `POST` | `/api/sla/scan` | Cron — fires SLA reminders/escalations/breaches |

## Branding

White surface, Airtel red (`#E40000`) as the only accent. Tailwind tokens
live in `tailwind.config.ts` under the `airtel.*` namespace and the
component classes in `src/app/globals.css` (`.btn-primary`, `.card`,
`.badge-red`, …).

## Not in scope (Phase 2)

- AI form assistant / category & module auto-detection
- Semantic deduplication (embedding-based)
- AI-generated BRD drafts
- Two-way Jira sync (placeholder fields already exist on `tickets`)
- Teams / external notification channels (column exists, sender not wired)
