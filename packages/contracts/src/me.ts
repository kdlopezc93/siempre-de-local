import { z } from 'zod';

/**
 * GET /api/v1/me — versión mínima de Fase 0 (solo el usuario).
 * Perfil, membresías y consentimiento se añaden en Fase 2 (docs/05-api.md · Yo).
 */
export const MeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
