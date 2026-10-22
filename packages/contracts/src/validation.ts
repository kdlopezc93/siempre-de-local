import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';

/**
 * GET /api/v1/teams/:teamId/validation — validación interna (docs/02 §11). Para quien valora,
 * solo cuenta a los jugadores que ya valoró (cuyo test ya puede ver): el informe no destapa
 * tests por el costado.
 */
export const ValidationResponseSchema = z.object({
  testVsStaff: z.object({
    /** Valoraciones a ciegas con test del jugador. */
    n: z.int(),
    exact: z.int(),
    inPodium: z.int(),
    confusion: z.array(
      z.object({ staff: PositionCodeSchema, test: PositionCodeSchema, count: z.int() }),
    ),
  }),
  knowledgeVsCard: z.array(
    z.object({
      position: PositionCodeSchema,
      /** Mejor puntaje de conocimiento (0–1) y media de la tarjeta (0–99) de cada jugador. */
      points: z.array(z.object({ pct: z.number(), mp: z.int() })),
      /** Spearman; null si hay menos de 5 jugadores con ambos datos o alguno no varía. */
      rho: z.number().nullable(),
    }),
  ),
});

export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
