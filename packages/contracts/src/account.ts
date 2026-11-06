import { z } from 'zod';

/** DELETE /api/v1/me — borrar la cuenta exige escribirlo, para que no sea un toque sin querer. */
export const DeleteAccountRequestSchema = z.object({ confirmation: z.literal('ELIMINAR') });
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

/**
 * GET /api/v1/me/export — todo lo tuyo, para descargar (derecho a conocer tus datos, `04` §5).
 * Resultados, no respuestas: nunca las correctas de los exámenes.
 */
export const MyDataExportSchema = z.object({
  exportedAt: z.iso.datetime(),
  account: z.object({ name: z.string(), email: z.string(), createdAt: z.iso.datetime() }),
  profile: z.unknown(),
  consents: z.array(
    z.object({
      policyVersion: z.string(),
      acceptedAt: z.iso.datetime(),
      revokedAt: z.iso.datetime().nullable(),
    }),
  ),
  memberships: z.unknown(),
  orientationTests: z.array(z.unknown()),
  knowledgeExams: z.array(z.unknown()),
  cards: z.array(
    z.object({
      team: z.string(),
      ratedAt: z.iso.datetime(),
      ratedBy: z.string().nullable(),
      values: z.record(z.string(), z.number()),
      notes: z.string().nullable(),
      /** La posición que le puso quien puntuó (02 §7.4). */
      position: z.string().nullable(),
    }),
  ),
  assessments: z.array(
    z.object({
      team: z.string(),
      createdAt: z.iso.datetime(),
      by: z.string().nullable(),
      primaryPosition: z.string(),
      secondaryPositions: z.array(z.string()),
      confidence: z.number(),
      blind: z.boolean(),
      notes: z.string().nullable(),
    }),
  ),
  /** Tus partidos: lo que respondiste y cómo te evaluaron (D18). */
  matches: z.array(
    z.object({
      team: z.string(),
      /** null en los entrenamientos (2026-10-28). */
      opponent: z.string().nullable(),
      startsAt: z.iso.datetime(),
      reply: z.enum(['yes', 'no']).nullable(),
      rating: z.int().nullable(),
      ratedBy: z.string().nullable(),
      note: z.string().nullable(),
      /** Si viniste, según "¿Quién vino?" (2026-10-30); null si no pasaron lista. */
      came: z.boolean().nullable(),
    }),
  ),
  /**
   * Tus cobros (2026-11-06, `02` §15): tu parte de cada uno y tus pagos, y las partes de
   * compañeros que asumiste (patrocinios). Si a ti te cubrieron una parte, sale `covered`, sin
   * quién (como en la app). Los anulados también, con `cancelled`.
   */
  charges: z.array(
    z.object({
      team: z.string(),
      kind: z.enum(['registration', 'referee', 'vaca', 'fee', 'fine', 'uniform', 'other']),
      title: z.string().nullable(),
      /** El partido del cobro, si es de uno (null en el entreno). */
      match: z.object({ opponent: z.string().nullable(), startsAt: z.iso.datetime() }).nullable(),
      tournament: z.string().nullable(),
      dueOn: z.iso.date().nullable(),
      createdAt: z.iso.datetime(),
      cancelled: z.boolean(),
      /** La parte de un compañero que asumiste; null si es la tuya. */
      forPlayer: z.string().nullable(),
      amount: z.int(),
      note: z.string().nullable(),
      covered: z.boolean(),
      payments: z.array(
        z.object({
          amount: z.int(),
          method: z.enum(['cash', 'nequi', 'daviplata', 'transfer', 'other']),
          paidOn: z.iso.date(),
          status: z.enum(['reported', 'confirmed', 'rejected']),
          createdAt: z.iso.datetime(),
        }),
      ),
    }),
  ),
});
export type MyDataExport = z.infer<typeof MyDataExportSchema>;
