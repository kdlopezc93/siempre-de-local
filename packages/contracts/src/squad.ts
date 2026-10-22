import { z } from 'zod';

import { AssessmentSchema } from './assessments.js';
import { PositionCodeSchema } from './orientation.js';

/**
 * GET /api/v1/teams/:teamId/squad — la plantilla para el cuerpo técnico. El test de cada
 * jugador queda oculto para quien valora hasta que registre su primera valoración de él:
 * así esa valoración es a ciegas (docs/06 · Fase 3).
 */
export const SquadResponseSchema = z.object({
  players: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      preferredPositions: z.array(PositionCodeSchema),
      test: z.discriminatedUnion('status', [
        z.object({ status: z.literal('none') }),
        /** Lo tiene, pero quien pregunta todavía no lo valoró. */
        z.object({ status: z.literal('hidden') }),
        z.object({
          status: z.literal('visible'),
          attemptId: z.uuid(),
          submittedAt: z.iso.datetime(),
          podium: z.array(PositionCodeSchema),
        }),
      ]),
      /** La valoración más reciente del cuerpo técnico, de quien sea. */
      latestAssessment: AssessmentSchema.nullable(),
      /** Si quien pregunta ya lo valoró alguna vez. */
      assessedByMe: z.boolean(),
    }),
  ),
});

export type SquadResponse = z.infer<typeof SquadResponseSchema>;
export type SquadPlayer = SquadResponse['players'][number];
