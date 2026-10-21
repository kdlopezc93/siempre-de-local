import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const APP_HOST = 'app.sdl.localtest.me';
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
        // El API vive en otro origen: el service worker no lo intercepta.
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
});
