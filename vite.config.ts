import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'IJAMBO English',
        short_name: 'IJAMBO',
        description:
          "Préparation TOEFL, IELTS et Duolingo English Test pour les étudiants burundais francophones.",
        theme_color: '#132019',
        background_color: '#F4F6F2',
        display: 'standalone',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // leçons et contenus consultés : cache-first avec revalidation
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(lessons|modules|courses|app_settings)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ijambo-content',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // audios en streaming progressif
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/audio\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ijambo-audio',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ijambo-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2018',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
