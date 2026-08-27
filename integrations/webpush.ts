import webpush from 'web-push'
import { config } from '@/lib/config'

webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY)

export { webpush }
