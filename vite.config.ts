import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new version waits for the user to accept it, so it never swaps mid-edit.
      registerType: 'prompt',
      manifest: {
        name: 'Task Scheduler',
        short_name: 'Tasks',
        description: 'Schedule your tasks and keep them in sync across your phone and laptop.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f2747',
        background_color: '#0f2747',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Only the app itself is cached here. Task data never goes through the service
      // worker, so the database stays the one source of truth.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
