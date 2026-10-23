import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const APP_HOST = 'app.sdl.localtest.me';
/**
 * Origen público del túnel de VS Code (scripts/dev-tunnel.sh y scripts/preview-tunnel.sh). Con él,
 * app y API van por un solo origen: el puerto del túnel sirve la app y reenvía /api al API.
 */
const TUNNEL_ORIGIN = process.env.SDL_TUNNEL_ORIGIN;
const TUNNEL_PORT = 4173;
/** Mismo nombre que API_CACHE_NAME en src/shared/offline/api-cache.ts. */
const API_CACHE_NAME = 'sdl-api';

// En WSL, los archivos bajo /mnt/c no emiten eventos de cambio: hay que sondear.
// Fuera de /mnt/c, la vigilancia por defecto de Vite. Ojo: `watch: null` la apaga.
const ON_WINDOWS_DRIVE = process.cwd().startsWith('/mnt/');
const watchOptions = ON_WINDOWS_DRIVE ? { watch: { usePolling: true, interval: 300 } } : {};

/**
 * /api → API local. El túnel reescribe Origin a http://localhost:4173 y Better Auth y el
 * chequeo CSRF lo rechazarían: se devuelve al origen público (solo ese valor; los demás
 * orígenes pasan tal cual y se siguen rechazando).
 */
/**
 * En `pnpm dev:tunnel` no hay service worker (solo en builds). Si el celular tiene instalado
 * el de una build anterior (preview:tunnel), seguiría sirviendo la app vieja desde su caché: este
 * reemplazo borra los cachés, se da de baja y recarga, y desde ahí manda el servidor de dev.
 */
const SELF_DESTROYING_SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
`;

function selfDestroyingServiceWorker(): Plugin {
  return {
    name: 'sdl-self-destroying-sw',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res) => {
        res.setHeader('content-type', 'text/javascript');
        res.setHeader('cache-control', 'no-store');
        res.end(SELF_DESTROYING_SW);
      });
    },
  };
}

/**
 * Los paquetes del monorepo (contracts, domain) se importan desde su fuente pero están
 * fuera de la carpeta de la web: Vite no se entera si cambian por fuera (p. ej. al
 * cambiar de rama) y sigue sirviendo la versión vieja. Se vigilan explícitamente.
 */
function watchWorkspacePackages(): Plugin {
  return {
    name: 'sdl-watch-workspace-packages',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(fileURLToPath(new URL('../../packages', import.meta.url)));
    },
  };
}

function tunnelProxy(publicOrigin: string): Record<string, ProxyOptions> {
  return {
    '/api': {
      // e2e levanta su propio API en otro puerto (e2e/README.md).
      target: process.env.SDL_API_TARGET ?? 'http://localhost:3000',
      xfwd: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (proxyReq.getHeader('origin') === `http://localhost:${TUNNEL_PORT}`) {
            proxyReq.setHeader('origin', publicOrigin);
          }
        });
      },
    },
  };
}

/**
 * Política de seguridad de contenido (07 §4.8, `04`): la app solo carga lo suyo. Scripts,
 * estilos, fuentes e iconos van empaquetados; el único otro origen es el API (`api.` en
 * staging; en local y por el túnel, el mismo origen). Sin `unsafe-inline`: el HTML del build no
 * trae nada en línea. Para sumar un origen, primero pasa por el inventario de terceros (`04`).
 */
export function contentSecurityPolicy(apiUrl: string | undefined): string {
  const api = apiUrl ? new URL(apiUrl).origin : null;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ''}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Los encabezados de seguridad, iguales en `vite preview` (túnel, e2e) y en Cloudflare Pages. */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Pone la CSP en el `_headers` del build (Cloudflare Pages), con el API de este build. */
function cspInHeadersFile(csp: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'sdl-csp-headers',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const file = join(outDir, '_headers');
      writeFileSync(file, readFileSync(file, 'utf8').replace('__CSP__', csp));
    },
  };
}

export default defineConfig(({ mode }) => {
  const csp = contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL);
  return {
    resolve: { conditions: ['@sdl/source'] },
    plugins: [
      react(),
      cspInHeadersFile(csp),
      watchWorkspacePackages(),
      ...(TUNNEL_ORIGIN ? [selfDestroyingServiceWorker()] : []),
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
          // Si el API comparte origen (túnel), su callback de OAuth no es la SPA.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Respuestas del API que deben verse sin conexión (ADR-06).
              // Por ruta y no por origen: en producción el API está en api.<dominio>.
              // La función se copia tal cual al service worker: no puede usar variables de aquí.
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                (['/api/v1/me', '/api/v1/me/attempts', '/api/v1/questionnaires/current'].includes(
                  url.pathname,
                ) ||
                  url.pathname.startsWith('/api/v1/attempts/') ||
                  // El planificador se usa en la cancha, a veces sin señal.
                  /^\/api\/v1\/teams\/[^/]+(\/lineup-inputs)?$/.test(url.pathname)),
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
    server: TUNNEL_ORIGIN
      ? {
          // pnpm dev:tunnel: el celular abre el túnel y recibe los cambios en vivo (HMR).
          port: TUNNEL_PORT,
          strictPort: true,
          allowedHosts: ['.devtunnels.ms'],
          // Sin `host`: el cliente de HMR se conecta al mismo host de la página (el túnel).
          hmr: { protocol: 'wss', clientPort: 443 },
          proxy: tunnelProxy(TUNNEL_ORIGIN),
          ...watchOptions,
        }
      : {
          // Caddy (https://app.sdl.localtest.me) reenvía al puerto 5173 del host.
          host: '0.0.0.0',
          port: 5173,
          strictPort: true,
          allowedHosts: [APP_HOST],
          hmr: { host: APP_HOST, protocol: 'wss', clientPort: 443 },
          ...watchOptions,
        },
    // pnpm preview:tunnel: build real con service worker servida por el mismo túnel.
    preview: {
      headers: { 'Content-Security-Policy': csp, ...SECURITY_HEADERS },
      port: TUNNEL_PORT,
      strictPort: true,
      allowedHosts: ['.devtunnels.ms', APP_HOST],
      ...(TUNNEL_ORIGIN ? { proxy: tunnelProxy(TUNNEL_ORIGIN) } : {}),
    },
  };
});
