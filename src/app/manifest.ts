import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UNO Mates — Play with your people',
    short_name: 'UNO Mates',
    description: 'A private card table for 2–10 friends. Stack +2 and +4, choose your seat, and play on until everyone has a rank.',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'window-controls-overlay'],
    background_color: '#020617',
    theme_color: '#022c22',
    orientation: 'portrait-primary',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/uno-mates-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
