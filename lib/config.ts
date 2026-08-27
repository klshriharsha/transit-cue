import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  VAPID_SUBJECT: z.string().min(1, 'VAPID_SUBJECT is required'),
  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY is required'),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
  // VBB (Berlin transit) departure times are naturally in this zone; commute pushTime
  // ("HH:MM") is compared against the current time in this zone, not the server's.
  TIMEZONE: z.string().default('Europe/Berlin'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')

  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const config = parsedEnv.data
