import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';

/** Examen de conocimiento por posición (docs/02 §6, docs/05 · Examen de conocimiento). */
export const KnowledgeBandSchema = z.enum(['mastery', 'solid', 'developing', 'insufficient']);
const AreaSchema = z.object({ code: z.string(), name: z.string() });

/** Re-evaluación pedida por el cuerpo técnico (02 §6.7). Vencida sigue abierta. */
export const KnowledgeReviewSchema = z.object({
  id: z.uuid(),
  position: PositionCodeSchema,
  /** Visible para el jugador. */
  reason: z.string(),
  requestedAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  status: z.enum(['pending', 'completed', 'expired', 'cancelled']),
  requestedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  resolvedExamId: z.uuid().nullable(),
});

const BestSchema = z.object({
  examId: z.uuid(),
  pct: z.number(),
  band: KnowledgeBandSchema,
  underReview: z.boolean(),
});

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
      best: BestSchema.nullable(),
      /** Re-evaluación abierta que me pidieron para esta posición (no espera el mes). */
      review: KnowledgeReviewSchema.nullable(),
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

const BoardPointSchema = z.object({ x: z.number(), y: z.number() });

/**
 * La pizarra de una pregunta (Fase 8, 02 §6.2): la jugada en la cancha de siempre (100×150,
 * tu arco abajo). Los puntos de respuesta no van aquí sino en cada opción, ya barajada.
 */
export const ExamBoardSchema = z.object({
  view: z.enum(['full', 'own-half', 'rival-half']),
  pieces: z.array(
    BoardPointSchema.extend({
      side: z.enum(['own', 'rival']),
      label: z.string().max(3).optional(),
      you: z.boolean().optional(),
      /** Hacia dónde mira, en grados (0 = hacia el arco rival); se dibuja como visera. */
      facing: z.number().min(0).lt(360).optional(),
    }),
  ),
  ball: BoardPointSchema.optional(),
  arrows: z
    .array(
      z.object({
        kind: z.enum(['pass', 'run', 'dribble']),
        from: BoardPointSchema,
        to: BoardPointSchema,
      }),
    )
    .optional(),
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
      /** Pregunta tipo pizarra, o null si es solo texto. */
      board: ExamBoardSchema.nullable(),
      /** `spot`: dónde se toca esa opción en la pizarra (si se responde tocando). */
      options: z.array(
        z.object({ id: z.uuid(), label: z.string(), spot: BoardPointSchema.nullable() }),
      ),
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
  /** Anulado por el cuerpo técnico: deja de contar. */
  voided: z.object({ reason: z.string(), at: z.iso.datetime() }).nullable(),
  /** Reemplazado por una re-evaluación posterior: queda en el historial, ya no cuenta. */
  superseded: z.boolean(),
  /** Presentado para responder una re-evaluación. */
  fromReview: z.boolean(),
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
export type ExamBoardView = z.infer<typeof ExamBoardSchema>;
export type ExamResult = z.infer<typeof ExamResultSchema>;
export type ExamResponse = z.infer<typeof ExamResponseSchema>;
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
export type MyExamsResponse = z.infer<typeof MyExamsResponseSchema>;

/** POST /api/v1/teams/:teamId/cert-exams/:examId/void (coach, admin del club) */
export const VoidExamRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  /** Deja que lo repita sin esperar el mes. */
  resetInterval: z.boolean().default(false),
});

/** POST /api/v1/teams/:teamId/players/:userId/knowledge-reviews (coach, admin del club) */
export const CreateKnowledgeReviewRequestSchema = z.object({
  position: PositionCodeSchema,
  reason: z.string().trim().min(5).max(500),
  dueInDays: z.int().min(1).max(60).default(14),
});

export const KnowledgeReviewResponseSchema = z.object({ review: KnowledgeReviewSchema });

/** El conocimiento de un jugador, para el cuerpo técnico (va en su perfil). */
export const PlayerKnowledgeSchema = z.object({
  positions: z.array(
    z.object({
      position: PositionCodeSchema,
      best: BestSchema.nullable(),
      /** Re-evaluación abierta (pendiente o vencida). */
      review: KnowledgeReviewSchema.nullable(),
    }),
  ),
  /** Todos sus exámenes cerrados, del más reciente al más antiguo. */
  exams: z.array(ExamResultSchema),
});

export type KnowledgeReview = z.infer<typeof KnowledgeReviewSchema>;
export type VoidExamRequest = z.input<typeof VoidExamRequestSchema>;
export type CreateKnowledgeReviewRequest = z.input<typeof CreateKnowledgeReviewRequestSchema>;
export type KnowledgeReviewResponse = z.infer<typeof KnowledgeReviewResponseSchema>;
export type PlayerKnowledge = z.infer<typeof PlayerKnowledgeSchema>;
