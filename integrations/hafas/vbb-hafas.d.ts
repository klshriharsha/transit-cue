declare module 'vbb-hafas' {
  import type { HafasClient, Profile } from 'hafas-client'

  export const defaults: { profile: Profile }

  export function createVbbHafas(userAgent: string, opt?: { profile?: Profile }): HafasClient
}
