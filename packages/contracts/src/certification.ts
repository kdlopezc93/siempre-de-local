import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';

/** Examen de conocimiento por posición (docs/02 §6, docs/05 · Examen de conocimiento). */
export const KnowledgeBandSchema = z.enum(['mastery', 'solid', 'developing', 'insufficient']);
const AreaSchema = z.object({ code: z.string(), name: z.string() });

/** GET /api/v1/certification/positions — de qué posiciones me puedo examinar y cómo voy. */
export const CertPositionsResponseSchema = z.object({
  positions: z.array(
    z.object({
      position: PositionCodeSchema,
      bank: z.object({
        label: z.string(),
        itemsPerExam: z.int(),
        timeLimitSeconds: z.int(),
        attemptIntervalDays: z.int(),
        areas: z.array(AreaSchema),
      }),
      /** Mi mejor puntaje válido (no caduca), o null si nunca me examiné. */
      best: z
        .object({
          examId: z.uuid(),
          pct: z.number(),
          band: KnowledgeBandSchema,
          underReview: z.boolean(),
        })
        .nullable(),
      /** Cuándo puedo volver a presentar esta posición; null = ya. */
      nextAttemptAt: z.iso.datetime().nullable(),
      /** Si tengo un examen a medias (de cualquier posición), su id. */
      activeExamId: z.uuid().nullable(),
    }),
  ),
});

/** POST /api/v1/cert-exams */
export const StartExamRequestSchema = z.object({
  position: PositionCodeSchema,
  /** Equipo desde el que se presenta; el puntaje es de la persona. */
  teamId: z.uuid().optional(),
});

/** Un examen en curso: las preguntas **sin** la correcta ni la explicación. */
export const ExamInProgressSchema = z.object({
  state: z.literal('in_progress'),
  examId: z.uuid(),
  position: PositionCodeSchema,
  startedAt: z.iso.datetime(),
  /** Lo fija el servidor; después no se aceptan respuestas. */
  deadlineAt: z.iso.datetime(),
  /** Hora del servidor al responder: el celular corrige su reloj con esto. */
  serverNow: z.iso.datetime(),
  items: z.array(
    z.object({
      id: z.uuid(),
      area: AreaSchema,
      text: z.string(),
      options: z.array(z.object({ id: z.uuid(), label: z.string() })),
      answerOptionId: z.uuid().nullable(),
    }),
  ),
});

/** Un examen cerrado: puntaje y desglose por área, **sin** las respuestas correctas. */
export const ExamResultSchema = z.object({
  state: z.literal('finished'),
  examId: z.uuid(),
  position: PositionCodeSchema,
  endedBy: z.enum(['submit', 'abandon', 'timeout']),
  startedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime(),
  score: z.int(),
  total: z.int(),
  pct: z.number(),
  band: KnowledgeBandSchema,
  byArea: z.array(z.object({ area: AreaSchema, correct: z.int(), total: z.int() })),
  nextAttemptAt: z.iso.datetime(),
});

/** POST /cert-exams y GET /cert-exams/:id */
export const ExamResponseSchema = z.discriminatedUnion('state', [
  ExamInProgressSchema,
  ExamResultSchema,
]);

/** PUT /api/v1/cert-exams/:id/answers/:itemId */
export const AnswerRequestSchema = z.object({ optionId: z.uuid() });

/** GET /api/v1/me/cert-exams — mis exámenes cerrados, del más reciente al más antiguo. */
export const MyExamsResponseSchema = z.object({ items: z.array(ExamResultSchema) });

export type KnowledgeBand = z.infer<typeof KnowledgeBandSchema>;
export type CertPositionsResponse = z.infer<typeof CertPositionsResponseSchema>;
export type StartExamRequest = z.infer<typeof StartExamRequestSchema>;
export type ExamInProgress = z.infer<typeof ExamInProgressSchema>;
export type ExamResult = z.infer<typeof ExamResultSchema>;
export type ExamResponse = z.infer<typeof ExamResponseSchema>;
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
export type MyExamsResponse = z.infer<typeof MyExamsResponseSchema>;
