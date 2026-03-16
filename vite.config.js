import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const PERENUAL_KEY = env.PERENUAL_API_KEY ?? ''

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'Coco et Cam font pousser',
        short_name: 'Cocobet Cam',
        description: 'On a la main verte… en théorie',
        theme_color: '#4a7c59',
        background_color: '#f5fbf6',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        lang: 'fr',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'weather-cache', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/perenual\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'perenual-cache', expiration: { maxAgeSeconds: 86400 * 7 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
    server: {
      proxy: {
        '/api/perenual': {
          target: 'https://perenual.com',
          changeOrigin: true,
          rewrite: (path) => {
            const match = path.match(/[?&]id=([^&]+)/)
            if (match) return `/api/species/details/${match[1]}?key=${PERENUAL_KEY}`
            const qMatch = path.match(/[?&]q=([^&]*)/)
            const q = qMatch ? qMatch[1] : ''
            return `/api/species-list?key=${PERENUAL_KEY}&q=${q}`
          },
        },
        '/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/anthropic/, ''),
        },
      },
    },
  }
})

