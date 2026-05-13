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

## Deploy to Vercel

- Push to GitHub and import the repo into Vercel.
- Add the same env vars in the Vercel project settings.
- Vercel auto-detects Next.js. The `vercel.json` already declares:
  - 30-s max duration for API routes
  - cron schedule `*/15 * * * *` hitting `/api/sla/scan`
- Add a custom header trigger for the cron by setting
  `CRON_SECRET` and configuring the cron to send `x-cron-secret`.

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
