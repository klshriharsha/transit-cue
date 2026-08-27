export type PushSubscriptionKeys = {
  auth: string
  p256dh: string
}

export type StoredSubscription = {
  endpoint: string
  keys: PushSubscriptionKeys
}

export type Station = {
  id: string
  name: string
}
