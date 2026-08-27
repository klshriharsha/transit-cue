import { createVbbHafas } from 'vbb-hafas'
import { config } from '@/lib/config'

// hafas-client asks integrators to identify themselves with a contact,
// which the VBB endpoint operator uses to reach out about API changes/abuse.
// Reuses the VAPID contact since that's already a real address the user configured.
const USER_AGENT = `transitcue (${config.VAPID_SUBJECT})`

export const hafasClient = createVbbHafas(USER_AGENT)
