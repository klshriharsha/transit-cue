declare module 'vbb-hafas' {
  import type { HafasClient } from 'hafas-client'

  export function createVbbHafas(userAgent: string): HafasClient
}
