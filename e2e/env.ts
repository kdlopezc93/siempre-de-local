/**
 * Entorno de las pruebas de punta a punta: su propia base (`sdl_e2e`) y sus propios puertos,
 * para no tocar la base de desarrollo ni chocar con `pnpm dev` o `pnpm dev:tunnel`.
 */
export const E2E = {
  /** App y API por un solo origen (vite preview reenvía /api), como en el túnel. */
  origin: 'http://app.sdl.localtest.me:4273',
  cookieDomain: 'sdl.localtest.me',
  apiPort: 3100,
  /** Servidor de Postgres (local: el de docker compose; CI: el servicio del job). */
  adminUrl: process.env['E2E_ADMIN_DATABASE_URL'] ?? 'postgres://sdl:sdl@localhost:5432/sdl',
  database: 'sdl_e2e',
  secret: 'clave-de-e2e-que-tiene-mas-de-32-caracteres',
} as const;

export const e2eDatabaseUrl = () => {
  const url = new URL(E2E.adminUrl);
  url.pathname = `/${E2E.database}`;
  return url.toString();
};

/** Variables del API en e2e: van por delante de cualquier .env. */
export const apiEnv = () => ({
  NODE_ENV: 'development',
  PORT: String(E2E.apiPort),
  DATABASE_URL: e2eDatabaseUrl(),
  BETTER_AUTH_URL: E2E.origin,
  WEB_ORIGIN: E2E.origin,
  COOKIE_DOMAIN: E2E.cookieDomain,
  BETTER_AUTH_SECRET: E2E.secret,
  GOOGLE_CLIENT_ID: 'e2e',
  GOOGLE_CLIENT_SECRET: 'e2e',
});
