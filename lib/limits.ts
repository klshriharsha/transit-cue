// Upper bounds on client-supplied strings, so a single request can't store or forward arbitrarily
// large values. Kept free of zod so client components can import them too.

/** Stop-search text. Generous for the longest VBB stop names, which stay well under 60 chars. */
export const MAX_STATION_QUERY_LENGTH = 100
/** HAFAS stop ids are short numeric strings (e.g. "900110001"). */
export const MAX_STATION_ID_LENGTH = 64
export const MAX_STATION_NAME_LENGTH = 200
/** Push service endpoints (FCM, Mozilla, Apple, WNS) are a few hundred chars at most. */
export const MAX_PUSH_ENDPOINT_LENGTH = 1024
/** p256dh is 87 base64url chars and auth is 22; leave headroom for padding variants. */
export const MAX_PUSH_KEY_LENGTH = 256
