import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';

/** POST /api/v1/teams/:teamId/assessments — dónde ve el cuerpo técnico a un jugador. */
export const CreateAssessmentRequestSchema = z
  .object({
    playerId: z.uuid(),
    primaryPosition: PositionCodeSchema,
    /** Hasta 2, sin repetir ni incluir la principal. */
    secondaryPositions: z.array(PositionCodeSchema).max(2).default([]),
    /** Qué tan seguro está, de 1 a 5. */
    confidence: z.int().min(1).max(5),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (a) =>
      new Set(a.secondaryPositions).size === a.secondaryPositions.length &&
      !a.secondaryPositions.includes(a.primaryPosition),
    'Las secundarias no se repiten ni incluyen la principal',
  );

export const AssessmentSchema = z.object({
  id: z.uuid(),
  playerId: z.uuid(),
  /** Quién valoró (null si se borró su cuenta). */
  assessor: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  primaryPosition: PositionCodeSchema,
  secondaryPositions: z.array(PositionCodeSchema),
  confidence: z.int(),
  /** true si se hizo sin haber visto el test del jugador (la primera de quien valora). */
  blind: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const AssessmentResponseSchema = z.object({ assessment: AssessmentSchema });
export const AssessmentListResponseSchema = z.object({ items: z.array(AssessmentSchema) });

export type CreateAssessmentRequest = z.input<typeof CreateAssessmentRequestSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type AssessmentResponse = z.infer<typeof AssessmentResponseSchema>;
export type AssessmentListResponse = z.infer<typeof AssessmentListResponseSchema>;
