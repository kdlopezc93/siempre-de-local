import { defineConfig, devices } from '@playwright/test';

import { apiEnv, E2E } from './env.js';

/** Flujo crítico en un navegador real (01 §4): invitar → unirse → test → resultado. */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  // Sin reintentos: el flujo cambia la base (el jugador ya quedaría unido al reintentar).
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: E2E.origin,
    locale: 'es-419',
    // El service worker se prueba aparte (docs/spikes/pwa.md); aquí estorbaría con su caché.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // El API compilado (pnpm e2e lo compila antes), sin .env: solo las variables de e2e.
      command: 'node dist/main.js',
      cwd: '../apps/api',
      env: apiEnv(),
      port: E2E.apiPort,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
    },
    {
      command:
        'pnpm exec vite build --mode tunnel && pnpm exec vite preview --mode tunnel --port 4273 --strictPort',
      cwd: '../apps/web',
      env: {
        VITE_API_URL: E2E.origin,
        SDL_TUNNEL_ORIGIN: E2E.origin,
        SDL_API_TARGET: `http://localhost:${E2E.apiPort}`,
      },
      url: E2E.origin,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
