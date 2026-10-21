import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const APP_HOST = 'app.sdl.localtest.me';
/** Mismo nombre que API_CACHE_NAME en src/shared/offline/api-cache.ts. */
const API_CACHE_NAME = 'sdl-api';

// En WSL, los archivos bajo /mnt/c no emiten eventos de cambio: hay que sondear.
const ON_WINDOWS_DRIVE = process.cwd().startsWith('/mnt/');

export default defineConfig({
  resolve: { conditions: ['@sdl/source'] },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Siempre de Local',
        short_name: 'De Local',
        description: 'La mano derecha de tu equipo de fútbol amateur.',
        lang: 'es-419',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b140f',
        theme_color: '#0b140f',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Solo woff2: los .woff de respaldo no hacen falta en navegadores con service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Si el API comparte origen (túnel del spike), su callback de OAuth no es la SPA.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Respuestas del API que deben verse sin conexión (ADR-06, docs/spikes/pwa.md).
            // Por ruta y no por origen: en producción el API está en api.<dominio>.
            // La función se copia tal cual al service worker: no puede usar variables de aquí.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              ['/api/v1/me', '/api/v1/spike/questionnaire'].includes(url.pathname),
            // Con red manda el servidor (revalida con ETag); sin red, la última copia.
            handler: 'NetworkFirst',
            options: {
              cacheName: API_CACHE_NAME,
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Caddy (https://app.sdl.localtest.me) reenvía al puerto 5173 del host.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [APP_HOST],
    hmr: { host: APP_HOST, protocol: 'wss', clientPort: 443 },
    watch: ON_WINDOWS_DRIVE ? { usePolling: true, interval: 300 } : null,
  },
  // Spike PWA (pnpm --filter @sdl/web spike:pwa): build real con service worker servido
  // por un túnel HTTPS; /api se reenvía al API local para que todo sea un solo origen.
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: ['.devtunnels.ms'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        xfwd: true,
        // El túnel de VS Code reescribe Origin a http://localhost:4173 y Better Auth y el
        // chequeo CSRF lo rechazan: se devuelve al origen público que pasa scripts/spike-pwa.sh.
        configure: (proxy) => {
          const publicOrigin = process.env.SPIKE_PUBLIC_ORIGIN;
          if (!publicOrigin) return;
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.getHeader('origin') === 'http://localhost:4173') {
              proxyReq.setHeader('origin', publicOrigin);
            }
          });
        },
      },
    },
  },
});
