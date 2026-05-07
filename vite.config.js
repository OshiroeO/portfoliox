import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PortfolioX',
        short_name: 'PortfolioX',
        description: 'Personal stock portfolio tracker',
        theme_color: '#07090f',
        background_color: '#07090f',
        display: 'standalone',
        start_url: '/dashboard',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/stooq\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'stooq-cache', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/stooq/, ''),
      },
    },
  },
})
