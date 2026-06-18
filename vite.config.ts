import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const LOGO_ICON =
  'https://assets.zyrosite.com/EnigzBPrgZr5GxnU/recurso-77-pP4VA9UNvFrtfbx3.png';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Yaavs Marketing',
        short_name: 'Yaavs',
        description: 'Panel de Marketing Yaavs — equipo, KPIs y agenda',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'es',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: LOGO_ICON,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: LOGO_ICON,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: LOGO_ICON,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/assets\.zyrosite\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'yaavs-brand-assets',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      /* SW en dev rompe carga en celular vía IP de red; probar PWA con npm run build && preview */
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
