import { z } from 'zod';

/**
 * GET /teams/:teamId/adoption — la app en el equipo (2026-11-06): por jugador, si entró esta
 * semana o antes (nunca la hora), si tiene avisos, si hizo el test y si respondió la última
 * convocatoria. Cuerpo técnico y administradores del club.
 */
export const AdoptionResponseSchema = z.object({
  players: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      seen: z.enum(['week', 'older']),
      notices: z.boolean(),
      testDone: z.boolean(),
      /** null si no hay convocatoria o está lesionado (no cuenta como pendiente). */
      repliedLast: z.boolean().nullable(),
    }),
  ),
  /** La última convocatoria (la más reciente que no se canceló), o null. */
  lastCallUp: z
    .object({ id: z.uuid(), opponent: z.string().nullable(), startsAt: z.iso.datetime() })
    .nullable(),
});
export type AdoptionResponse = z.infer<typeof AdoptionResponseSchema>;
