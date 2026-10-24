import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Where the app is served from. '/' for the Android app and normal hosting.
// The GitHub Pages workflow sets VITE_BASE to '/<repo-name>/' because Pages
// serves a project site from a sub-folder, not from the domain root.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  // Stamped into the app at build time and shown at the bottom of Settings, so
  // it is always possible to tell exactly which build is installed (compare the
  // short commit id with the latest commit on GitHub). GITHUB_SHA is set
  // automatically by GitHub Actions; local builds show "dev".
  // __APP_BUILD__ is the CI run number (APP_BUILD is set by the workflow). It
  // is what the in-app update check compares against the newest `build-N`
  // GitHub release; local builds get 0, which turns the update check off.
  define: {
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
    __APP_BUILT__: JSON.stringify(new Date().toISOString()),
    __APP_BUILD__: JSON.stringify(Number(process.env.APP_BUILD) || 0)
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
        // Warm paper for the browser/app chrome, pure black (the logo tile) behind the icon on the launch screen.
        theme_color: '#F6F1E8',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api/],
        // Adds the notification-tap handler (public/notification-sw.js) to the worker.
        importScripts: ['notification-sw.js']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
