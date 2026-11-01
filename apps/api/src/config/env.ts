import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** URL pública del API (p. ej. https://api.sdl.localtest.me). */
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Origen de la PWA: único origen con CORS y permitido para métodos que modifican. */
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }),
  /** Dominio padre de app. y api. para la cookie de sesión compartida. */
  COOKIE_DOMAIN: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /** Avisos (Web Push, D16): sin las tres, los avisos quedan apagados. `npx web-push generate-vapid-keys`. */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  /** Contacto para los servicios de push: mailto:… o https://… */
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/)
    .optional(),
  /**
   * Tareas programadas (GitHub Actions → `POST /api/v1/cron/*`, 2026-10-31): la llamada lleva
   * `Authorization: Bearer <CRON_SECRET>`. Sin ella, esas rutas no existen (404).
   */
  CRON_SECRET: z.string().min(32).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida el entorno al arrancar: si falta algo, el API no levanta. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
