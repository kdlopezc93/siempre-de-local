import { z } from 'zod';

/**
 * TEMPORAL · spike PWA de Fase 0 (docs/spikes/pwa.md). Simula el par
 * GET /questionnaires/current + POST /attempts para probar caché y cola offline.
 * Se borra cuando exista el test de orientación real (Fase 3).
 */

/** GET /api/v1/spike/questionnaire — con ETag; la PWA lo cachea para usarlo sin conexión. */
export const SpikeQuestionnaireSchema = z.object({
  version: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() })),
    }),
  ),
});

export type SpikeQuestionnaire = z.infer<typeof SpikeQuestionnaireSchema>;

/** POST /api/v1/spike/attempts — idempotente por `clientAttemptId`. */
export const SpikeAttemptRequestSchema = z.object({
  clientAttemptId: z.uuid(),
  questionnaireVersion: z.string(),
  submittedAt: z.iso.datetime(),
  answers: z.array(z.object({ questionId: z.string(), optionId: z.string() })).min(1),
});

export type SpikeAttemptRequest = z.infer<typeof SpikeAttemptRequestSchema>;

/** 201 la primera vez; 200 con el mismo cuerpo si el intento ya se había recibido. */
export const SpikeAttemptResponseSchema = z.object({
  clientAttemptId: z.uuid(),
  receivedAt: z.iso.datetime(),
  answerCount: z.number().int(),
});

export type SpikeAttemptResponse = z.infer<typeof SpikeAttemptResponseSchema>;
