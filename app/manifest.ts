import type { MetadataRoute } from 'next'

// iOS only delivers push notifications to apps added to the Home Screen, which is why this
// manifest (plus the apple-touch-icon link in the layout) needs to be real, not decorative.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TransitCue',
    short_name: 'TransitCue',
    description: 'Scheduled transit commute reminders',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
