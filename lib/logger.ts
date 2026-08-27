import pino from 'pino'
import { config } from '@/lib/config'

export const logger = pino({ level: config.LOG_LEVEL })
