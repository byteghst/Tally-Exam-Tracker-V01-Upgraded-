import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  // Stamped into the app at build time and shown at the bottom of Settings, so
  // it is always possible to tell exactly which build is installed (compare the
  // short commit id with the latest commit on GitHub). GITHUB_SHA is set
  // automatically by GitHub Actions; local builds show "dev".
  define: {
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
    __APP_BUILT__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done manually in main.tsx, gated on NOT running
      // inside Capacitor — a service worker has no purpose in the native
      // app (Capacitor already serves everything locally) and can actively
      // cause stale-app-code bugs there if one gets registered and survives
      // an APK update.
      injectRegister: false,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'],
      manifest: {
        name: 'Tally',
        short_name: 'Tally',
        description: 'Tally — a manual-first exam and task tracker, synced across your devices',
        // Logo blue for the browser/app chrome, logo navy behind the icon on the launch screen.
        theme_color: '#0055FE',
        background_color: '#030C21',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
