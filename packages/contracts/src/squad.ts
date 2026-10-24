import { z } from 'zod';

import { AssessmentSchema } from './assessments.js';
import { KnowledgeBandSchema, PlayerKnowledgeSchema } from './certification.js';
import { PositionCodeSchema } from './orientation.js';
import { ProfileSchema } from './profile.js';
import { PlayerRatingSchema } from './ratings.js';
import { InjurySchema } from './teams.js';

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
      /**
       * Si quien pregunta puede valorarlo (04 §2.2): nadie a sí mismo y a los del cuerpo
       * técnico solo el entrenador. Si no puede, su test se ve sin más.
       */
      canRate: z.boolean(),
      /** Lesionado (lo marca el cuerpo técnico), o null. */
      injury: InjurySchema.nullable(),
      /** Mejor puntaje de conocimiento por posición, y si tiene una re-evaluación abierta. */
      knowledge: z.array(
        z.object({
          position: PositionCodeSchema,
          pct: z.number().nullable(),
          band: KnowledgeBandSchema.nullable(),
          review: z.enum(['pending', 'expired']).nullable(),
        }),
      ),
      /** Su tarjeta vigente (la foto más reciente), o null si nadie la puntuó. */
      card: z
        .object({
          ratedAt: z.iso.datetime(),
          positionAverages: z.partialRecord(PositionCodeSchema, z.int()),
        })
        .nullable(),
    }),
  ),
});

export type SquadResponse = z.infer<typeof SquadResponseSchema>;
export type SquadPlayer = SquadResponse['players'][number];

/**
 * GET /api/v1/teams/:teamId/players/:userId/profile — todo lo de un jugador en una pantalla
 * (cuerpo técnico y admin del club). Misma regla que la plantilla: para quien valora, el
 * test queda oculto hasta que lo valora. Los puntajes de conocimiento llegan en la Fase 4.
 */
export const PlayerProfileResponseSchema = z.object({
  player: ProfileSchema.extend({
    userId: z.uuid(),
    jerseyNumber: z.int().nullable(),
  }),
  test: z.discriminatedUnion('status', [
    z.object({ status: z.literal('none') }),
    z.object({ status: z.literal('hidden') }),
    z.object({
      status: z.literal('visible'),
      attemptId: z.uuid(),
      submittedAt: z.iso.datetime(),
      podium: z.array(PositionCodeSchema),
      /** Afinidad 0–1 de cada posición del formato, de mayor a menor. */
      ranking: z.array(z.object({ pos: PositionCodeSchema, pct: z.number() })),
    }),
  ]),
  /** Todas las valoraciones del cuerpo técnico, de la más reciente a la más antigua. */
  assessments: z.array(AssessmentSchema),
  assessedByMe: z.boolean(),
  /** Si quien pregunta puede valorarlo y puntuar su tarjeta (04 §2.2). */
  canRate: z.boolean(),
  injury: InjurySchema.nullable(),
  /** La foto vigente de la tarjeta, o null. */
  card: PlayerRatingSchema.nullable(),
  /** Cuántas fotos tiene en total (las anteriores se ven en …/ratings). */
  cardCount: z.int(),
  /** Examen de conocimiento por posición, sus exámenes y re-evaluaciones abiertas. */
  knowledge: PlayerKnowledgeSchema,
});

export type PlayerProfileResponse = z.infer<typeof PlayerProfileResponseSchema>;

/**
 * GET /api/v1/teams/:teamId/members — quiénes son del equipo, para todos sus miembros (y el
 * admin del club): el cuerpo técnico con su rol y los jugadores con su dorsal y su mejor banda
 * de conocimiento (D11: banda y posición, nunca el puntaje; "Insuficiente" no se muestra).
 */
export const TeamMembersResponseSchema = z.object({
  staff: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      role: z.enum(['coach', 'assistant']),
    }),
  ),
  players: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      /** Lesionado: los compañeros ven la marca, sin la fecha. */
      injured: z.boolean(),
      bestBand: z
        .object({
          position: PositionCodeSchema,
          band: KnowledgeBandSchema.exclude(['insufficient']),
        })
        .nullable(),
    }),
  ),
});
export type TeamMembersResponse = z.infer<typeof TeamMembersResponseSchema>;
