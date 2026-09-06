# Transit Cue

Transit Cue is a small progressive web app that tells you the exact minute to leave for your commute. You pick a departure stop, a destination stop, and a time of day; from then on the app sends a web-push notification at that time with live departure info for your line — "M10 from Eberswalder Straße to Nordbahnhof departs in 6 mins (on time). Next one in 16 mins." — so you never sprint for a bus that already left.

Departure data comes from the VBB (Berlin/Brandenburg) transit network via the HAFAS API. There are no user accounts: a device is identified only by its browser push subscription, so "your data" is one row keyed to that subscription. iOS only delivers push to home-screen installs, hence the PWA manifest and service worker.

### How it works

- The browser subscribes to push (`hooks/usePushSubscription.ts`) and the subscription is
stored via `POST /api/subscribe`.
- Saving a commute (`POST /api/config`) upserts the origin/destination stops and push time.
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
| Scheduling         | External cron (cron-job.org or similar) hitting `/api/cron`                                                                       |
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
pnpm exec supabase login      # one-time; stores an access token
pnpm exec supabase start      # boots local Postgres + Studio in Docker
pnpm exec supabase db reset   # applies every migration + seed.sql
```

`pnpm exec supabase start` prints a local API URL and a `service_role` key — put those into `.env.local`
as `SUPABASE_URL` (`http://127.0.0.1:54321`) and `SUPABASE_SERVICE_ROLE_KEY`. Studio runs at
[http://127.0.0.1:54323](http://127.0.0.1:54323). The full migration workflow (creating migrations, hosted dev
projects, CI deploys) is in [`supabase/README.md`](supabase/README.md).

### 5. Run the dev server

```bash
pnpm dev
```

This serves over HTTPS (`next dev --experimental-https`) because service workers and Web Push
require a secure context. Open [https://localhost:3000](https://localhost:3000) and accept the self-signed
certificate warning. Enable notifications, add a commute, and the alert is saved to your local
database.

### 6. (Optional) Trigger a reminder run

Nothing is scheduled locally, so fire the cron endpoint by hand to test delivery:

```bash
curl -k -X POST https://localhost:3000/api/cron \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

It sends pushes for any commute whose push time matches the current minute in `TIMEZONE`.

## Other scripts


| Command      | Does                     |
| ------------ | ------------------------ |
| `pnpm build` | production build         |
| `pnpm start` | serve a production build |
| `pnpm lint`  | ESLint                   |


