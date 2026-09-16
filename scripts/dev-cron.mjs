#!/usr/bin/env node
// Simulates the external cron service (cron-job.org in production) for local dev: hits
// POST /api/cron once a minute, on the minute, so `runDueReminders()` sees the same cadence
// it gets in production. Run this in a second terminal alongside `pnpm dev`.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

loadEnv({ path: path.join(repoRoot, '.env.local'), quiet: true })

const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('[dev-cron] CRON_SECRET is not set. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}

const url = process.env.CRON_URL ?? `https://localhost:${process.env.PORT ?? 3000}/api/cron`

// `next dev --experimental-https` serves a self-signed cert; this script only ever talks to
// localhost, so relax TLS verification the same way the README's `curl -k` example does.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function trigger() {
  const at = new Date().toISOString()
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
    const body = await res.json().catch(() => null)
    console.log(`[dev-cron] ${at} -> ${res.status}`, body ?? '')
  } catch (err) {
    console.error(`[dev-cron] ${at} request failed:`, err instanceof Error ? err.message : err)
  }
}

function msUntilNextMinute() {
  const now = new Date()
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds())
}

console.log(`[dev-cron] simulating the once-a-minute external cron trigger against ${url}. Ctrl+C to stop.`)

setTimeout(function tick() {
  trigger()
  setInterval(trigger, 60_000)
}, msUntilNextMinute())
