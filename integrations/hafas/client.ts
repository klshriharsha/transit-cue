import { withThrottling } from 'hafas-client/throttle.js'
import { createVbbHafas, defaults } from 'vbb-hafas'
import { config } from '@/lib/config'

// hafas-client asks integrators to identify themselves with a contact,
// which the VBB endpoint operator uses to reach out about API changes/abuse.
// Reuses the VAPID contact since that's already a real address the user configured.
const USER_AGENT = `transitcue (${config.VAPID_SUBJECT})`

// Caps outgoing VBB requests per server instance (hafas-client's recommended default); excess
// calls queue rather than fail. This protects VBB from bursts such as many alerts due in the same
// cron minute, but it is per instance, not a global limit across concurrent serverless instances.
const MAX_REQUESTS_PER_SECOND = 5

export const hafasClient = createVbbHafas(USER_AGENT, {
  profile: withThrottling(defaults.profile, MAX_REQUESTS_PER_SECOND, 1000),
})
