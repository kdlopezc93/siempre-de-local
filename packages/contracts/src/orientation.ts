import { z } from 'zod';

import { MatchFormatSchema } from './teams.js';

/** Orden canónico (docs/02 §1); el mismo de @sdl/domain. */
export const PositionCodeSchema = z.enum(['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC']);
export type PositionCode = z.infer<typeof PositionCodeSchema>;

/**
 * GET /api/v1/questionnaires/current — la versión publicada, para cachearla y responder
 * sin conexión (ADR-06): ítems de posición con sus pesos.
 */
export const QuestionnaireResponseSchema = z.object({
  versionId: z.uuid(),
  label: z.string(),
  positionItemsPerAttempt: z.int(),
  positionItems: z.array(
    z.object({
      id: z.uuid(),
      code: z.string(),
      context: z.enum(['situation', 'attribute']),
      text: z.string(),
      options: z.array(
        z.object({
          id: z.uuid(),
          label: z.string(),
          points: z.partialRecord(PositionCodeSchema, z.int()),
        }),
      ),
    }),
  ),
});

const ServedItemSchema = z.object({
  itemId: z.uuid(),
  shownOrder: z.int().min(1),
  /** Orden en que se mostraron las opciones (ids), para analizar sesgos de posición. */
  optionOrder: z.array(z.uuid()).min(2),
  answerOptionId: z.uuid(),
});

/** POST /api/v1/attempts — envío completo, en línea o desde la cola offline. */
export const SubmitAttemptRequestSchema = z.object({
  clientAttemptId: z.uuid(),
  teamId: z.uuid(),
  questionnaireVersionId: z.uuid(),
  format: MatchFormatSchema,
  startedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime(),
  positionItems: z.array(ServedItemSchema).min(1),
});

/** Resultado oficial (calculado en el servidor). 201 la primera vez; 200 si se reenvía. */
export const AttemptResultSchema = z.object({
  attemptId: z.uuid(),
  clientAttemptId: z.uuid(),
  teamId: z.uuid(),
  format: MatchFormatSchema,
  submittedAt: z.iso.datetime(),
  /** La primera del podio. */
  winner: PositionCodeSchema,
  ranking: z.array(z.object({ pos: PositionCodeSchema, pct: z.number() })),
  /** Las 3 posiciones con más afinidad: el resultado principal del test. */
  podium: z.array(PositionCodeSchema),
  /** Dónde certificarse en conocimiento (Fase 4): las del podio. */
  suggestedKnowledgeExams: z.array(PositionCodeSchema),
});

/** GET /api/v1/me/attempts */
export const AttemptListResponseSchema = z.object({ items: z.array(AttemptResultSchema) });

export type QuestionnaireResponse = z.infer<typeof QuestionnaireResponseSchema>;
export type SubmitAttemptRequest = z.infer<typeof SubmitAttemptRequestSchema>;
export type AttemptResult = z.infer<typeof AttemptResultSchema>;
export type AttemptListResponse = z.infer<typeof AttemptListResponseSchema>;
