# Transit Cue

Transit Cue is a small progressive web app that tells you the exact minute to leave for your commute. You pick a departure stop, a destination stop, and a time of day; from then on the app sends a web-push notification at that time with the next three departures for your line — titled "Eberswalder Straße → Nordbahnhof", with a body of "M10 · 08:15 · on time\nM10 · 08:32 · on time\nM10 · 08:47 · +3 min" — so you never sprint for a bus that already left, and still know your options if you miss the next one.

Departure data comes from the VBB (Berlin/Brandenburg) transit network via the HAFAS API. There are no user accounts: a browser is identified by a random `client_id` it generates once and keeps in `localStorage`, and "your data" is the one subscription row (plus up to 5 commute configs) keyed to that id. The id is decoupled from the push endpoint on purpose — the endpoint rotates every time notifications are toggled off and back on, so keying on it would strand the saved commutes. iOS only delivers push to home-screen installs, hence the PWA manifest and service worker.

### How it works

- The browser subscribes to push (`hooks/usePushSubscription.ts`) and the subscription is
stored via `POST /api/subscribe`, keyed by the browser's `client_id` (`lib/client-id.ts`) so
that toggling notifications off/on updates the same row instead of creating an orphan.
- Saving a commute (`POST /api/config`) adds an origin/destination/push-time row against that
subscription, up to 5 per subscription; `GET /api/config` lists them and
`DELETE /api/config/[id]` removes one.
- When a push send gets `404`/`410` from the push service, the cron handler deletes the dead
subscription row (its commute configs cascade with it).
- An external cron service (e.g. cron-job.org) calls `GET/POST /api/cron` once a minute with
a shared bearer secret. The handler finds every commute whose push time matches the current
minute (in `TIMEZONE`), looks up the next departures from HAFAS, and sends the push.
- Station search (`GET /api/stations/search`) proxies HAFAS location lookups for the
type-ahead in the form.

## Tech stack


| Area               | Choice                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | [Next.js](https://nextjs.org) 16 (App Router, Route Handlers), React 19                                                           |
| Language           | TypeScript 5                                                                                                                      |
| Styling            | Tailwind CSS v4 (`@tailwindcss/postcss`), fonts via `next/font` (Instrument Sans, JetBrains Mono)                                 |
| Database           | Postgres on [Supabase](https://supabase.com), accessed server-side with `@supabase/supabase-js` (service-role key)                |
| Schema management  | Supabase CLI migrations under `supabase/migrations/` (see [`supabase/README.md`](supabase/README.md))                             |
| Push notifications | Web Push / VAPID via [`web-push`](https://github.com/web-push-libs/web-push), service worker in `public/sw.js`                    |
| Transit data       | [`vbb-hafas`](https://github.com/public-transport/vbb-hafas) / [`hafas-client`](https://github.com/public-transport/hafas-client) |
| Validation         | [`zod`](https://zod.dev) (environment config + request bodies)                                                                    |
| Logging            | [`pino`](https://getpino.io) (`pino-pretty` in development)                                                                       |
| Package manager    | [`pnpm`](https://pnpm.io) 11                                                                                                      |
| Linting            | ESLint (`eslint-config-next`)                                                                                                     |
| Scheduling         | External cron (cron-job.org or similar) hitting `/api/cron`; simulated locally by `pnpm dev:cron` (uses [`dotenv`](https://github.com/motdotla/dotenv) to load `.env.local`) |
| Hosting            | Vercel                                                                                                                            |


## Running locally

### Prerequisites

- **Node.js 20+**
- **pnpm 11** — `corepack enable` will pick up the version pinned in `package.json`
- **Docker** — only if you want the full local Supabase stack (the recommended path; see
`supabase/README.md` for the no-Docker alternative)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate VAPID keys

Web Push needs a VAPID key pair. Generate one and keep the output for the next step:

```bash
pnpm setup   # runs `web-push generate-vapid-keys --json`
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — from step 2.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY` (it is inlined into the
browser bundle so the page can call `PushManager.subscribe()`).
- `VAPID_SUBJECT` — a `mailto:` address, e.g. `mailto:you@example.com`.
- `CRON_SECRET` — any long random string, e.g. `openssl rand -hex 32`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — set in the next step.
- `TIMEZONE`, `LOG_LEVEL` — optional; defaults are `Europe/Berlin` and `info`.

### 4. Start the database

```bash
pnpm exec supabase login       # one-time; stores an access token
pnpm exec supabase start       # boots local Postgres + Studio in Docker (needs Docker running)
pnpm exec supabase db reset    # applies every migration + seed.sql
```

This stack runs with Supabase Auth disabled (see [`supabase/config.toml`](supabase/config.toml)),
so `supabase status` does **not** print an API key. Because no custom `jwt_secret` is set, the
local stack uses the Supabase CLI's built-in default keys — the same fixed value on every
machine. Put these in `.env.local`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

That is a well-known local-only dev credential, not a secret. Studio (table browser, SQL
editor) runs at [http://127.0.0.1:54323](http://127.0.0.1:54323). The full migration workflow
(creating migrations, hosted dev projects, CI deploys) is in
[`supabase/README.md`](supabase/README.md).

### 5. Run the dev server

```bash
pnpm dev
```

This serves over HTTPS (`next dev --experimental-https`) because service workers and Web Push
require a secure context. Open [https://localhost:3000](https://localhost:3000) and accept the self-signed
certificate warning. Enable notifications, add a commute, and the alert is saved to your local
database.

### 6. (Optional) Simulate the cron trigger

Nothing is scheduled locally by default — in production an external service (cron-job.org)
hits `/api/cron` once a minute. To get that same cadence locally, run in a second terminal:

```bash
pnpm dev:cron
```

This reads `CRON_SECRET` from `.env.local` and calls `POST https://localhost:3000/api/cron`
on the minute, every minute, until you stop it (Ctrl+C) — so any commute whose push time
matches the current minute fires a real push, just like in production. Target URL defaults
to `https://localhost:3000`; override with `CRON_URL` (full URL) or `PORT` (if `pnpm dev` is
running on a non-default port).

For a one-off trigger instead, `curl` the endpoint directly:

```bash
curl -k -X POST https://localhost:3000/api/cron \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

## Deploying

Once set up, the pipeline is: **open a PR → Vercel builds a preview deployment and, if the PR
touches `supabase/**`, CI dry-runs the migration → merge to `main` → CI applies any pending
migrations to production and Vercel deploys the merged code to production.** No manual deploy
step, ever, after the one-time setup below.

### One-time setup

1. **Supabase (production project).** Create it at
[supabase.com/dashboard](https://supabase.com/dashboard) (free tier) if you haven't already.
From Project Settings, collect:
   - **API → Project URL and `service_role` key** — these become `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` in Vercel (step 3).
   - **Database → Database password**, the project's **ref** (the `<ref>` in
   `https://<ref>.supabase.co`), and a personal
   [access token](https://supabase.com/dashboard/account/tokens) — these become the three
   GitHub Action secrets below. Never paste these into a chat or commit them; set them
   directly in the GitHub/Vercel UI (or via `gh secret set <NAME>`, which prompts for the
   value without echoing it).

2. **Wire up the existing migrations workflow.** In the GitHub repo, add these under
Settings → Secrets and variables → Actions:

   | Secret | Value |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | the personal access token above |
   | `SUPABASE_PROJECT_ID` | the project ref |
   | `SUPABASE_DB_PASSWORD` | the database password |

   Then bootstrap the (empty) production schema once: Actions tab → **Database migrations** →
   **Run workflow** (see [`supabase/README.md`](supabase/README.md) for details). Every future
   migration lands automatically on merge — nothing further to do here.

3. **Vercel (app hosting + CI/CD).** [Import the GitHub repo](https://vercel.com/new) as a new
Vercel project (free Hobby tier); the Next.js preset is auto-detected, no config needed. In
Project Settings → Environment Variables, add (Production — and Preview too, if you want PRs
to hit a real backend):

   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from step 1.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — generate with
   `pnpm setup:vapid` (public key goes in both of the last two).
   - `VAPID_SUBJECT` — a `mailto:` address.
   - `CRON_SECRET` — a long random string, e.g. `openssl rand -hex 32`.
   - `TIMEZONE`, `LOG_LEVEL` — optional, same defaults as local dev.

   This single connection is the CI/CD pipeline for the app: every push to `main` deploys to
   production, every PR gets its own preview URL, automatically.

4. **cron-job.org (scheduler).** This lives outside the pipeline — it just needs to point at
your stable production URL once. Sign up free at [cron-job.org](https://cron-job.org), create a
job for `https://<your-vercel-domain>/api/cron`, interval **every 1 minute**, with a custom
header `Authorization: Bearer <your CRON_SECRET>`.

5. **Verify.** Open the production URL, enable notifications, add a commute for a minute or two
in the future, and confirm the push arrives.

### Notes

- Free-tier Supabase projects pause after 7 days with no API activity. For an alpha with
sparse usage, an idle project may need a manual resume from the dashboard before the next cron
run succeeds.
- Vercel's Hobby cron is capped at once/day, which is why the scheduler lives outside Vercel
(`/api/cron` accepts `GET` or `POST` from anywhere with the right bearer token).

## Other scripts


| Command         | Does                                                     |
| ---------------- | -------------------------------------------------------- |
| `pnpm build`     | production build                                         |
| `pnpm start`     | serve a production build                                 |
| `pnpm lint`      | ESLint                                                    |
| `pnpm dev:cron`  | simulate the once-a-minute external cron trigger locally |


