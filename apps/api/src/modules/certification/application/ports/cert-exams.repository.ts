import type { Difficulty, ExamConfig, KnowledgeBand, PositionCode } from '@sdl/domain';

export interface Area {
  code: string;
  name: string;
}

/** La versión publicada del banco de una posición, con lo que necesita la selección. */
export interface PublishedBank {
  id: string;
  position: PositionCode;
  label: string;
  config: ExamConfig;
  areas: Area[];
  items: { id: string; area: string; difficulty: Difficulty; optionIds: string[] }[];
}

export interface StoredExam {
  id: string;
  userId: string;
  teamId: string | null;
  bankVersionId: string;
  position: PositionCode;
  status: 'in_progress' | 'submitted' | 'void';
  startedAt: Date;
  deadlineAt: Date;
  nextAttemptAt: Date;
  submittedAt: Date | null;
  endedBy: 'submit' | 'abandon' | 'timeout' | null;
  score: number | null;
  total: number | null;
  pct: number | null;
  band: KnowledgeBand | null;
  byArea: { area: string; correct: number; total: number }[] | null;
  underReview: boolean;
  supersededAt: Date | null;
  reviewRequestId: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  voidResetsInterval: boolean;
}

export interface StoredReview {
  id: string;
  teamId: string;
  playerUserId: string;
  position: PositionCode;
  reason: string;
  requestedAt: Date;
  dueAt: Date;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  requestedBy: { id: string; name: string } | null;
  resolvedExamId: string | null;
}

/** Una pregunta del examen tal como se mostró. `correctOptionId` nunca sale del API. */
export interface ExamItem {
  itemId: string;
  area: Area;
  text: string;
  /** En el orden barajado en que se mostraron. */
  options: { id: string; label: string }[];
  correctOptionId: string;
  answerOptionId: string | null;
}

export interface NewExam {
  userId: string;
  teamId: string | null;
  bankVersionId: string;
  position: PositionCode;
  startedAt: Date;
  deadlineAt: Date;
  nextAttemptAt: Date;
  /** Si responde una re-evaluación. */
  reviewRequestId: string | null;
  items: { itemId: string; optionOrder: string[] }[];
}

export interface ExamClosing {
  endedBy: 'submit' | 'abandon' | 'timeout';
  submittedAt: Date;
  score: number;
  total: number;
  pct: number;
  band: KnowledgeBand;
  byArea: { area: string; correct: number; total: number }[];
}

export interface CertExamsRepository {
  publishedBanks(): Promise<Omit<PublishedBank, 'items'>[]>;
  publishedBank(position: PositionCode): Promise<PublishedBank | null>;
  /** Áreas de cada posición, para nombrarlas en los resultados. */
  areasOf(position: PositionCode): Promise<Area[]>;
  /** Todos los exámenes de la persona, del más reciente al más antiguo. */
  examsOf(userId: string): Promise<StoredExam[]>;
  /** Preguntas que ya le salieron en exámenes de esa posición. */
  seenItemIds(userId: string, position: PositionCode): Promise<Set<string>>;
  /** 'in-progress' si otra petición abrió un examen a la vez (índice único). */
  createExam(exam: NewExam): Promise<string | 'in-progress'>;
  findExam(examId: string): Promise<StoredExam | null>;
  examItems(examId: string): Promise<ExamItem[]>;
  saveAnswer(examId: string, itemId: string, optionId: string, at: Date): Promise<void>;
  /** Cierra si sigue en curso; false si otra petición ya lo cerró. */
  closeExam(examId: string, closing: ExamClosing): Promise<boolean>;
  /** Anula un examen entregado; false si no estaba entregado. */
  voidExam(
    examId: string,
    voiding: { reason: string; by: string; at: Date; resetsInterval: boolean },
  ): Promise<boolean>;
  /** Marca como sustituidos los exámenes entregados de esa posición anteriores a `before`. */
  supersedeEarlier(userId: string, position: PositionCode, before: Date, at: Date): Promise<void>;
  /** Exámenes de varias personas (para la plantilla). */
  examsOfUsers(userIds: string[]): Promise<StoredExam[]>;

  /** Pasa a vencidas las pendientes con plazo cumplido. */
  expireDueReviews(now: Date): Promise<void>;
  /** Abiertas (pendientes o vencidas) de esas personas. */
  openReviews(userIds: string[]): Promise<StoredReview[]>;
  findReview(reviewId: string): Promise<StoredReview | null>;
  /** 'already-open' si ya hay una abierta para esa persona y posición. */
  createReview(review: {
    teamId: string;
    playerUserId: string;
    position: PositionCode;
    requestedBy: string;
    reason: string;
    requestedAt: Date;
    dueAt: Date;
  }): Promise<StoredReview | 'already-open'>;
  closeReview(
    reviewId: string,
    close: { status: 'completed' | 'cancelled'; at: Date; resolvedExamId?: string },
  ): Promise<void>;
}

export const CERT_EXAMS_REPOSITORY = Symbol('CERT_EXAMS_REPOSITORY');
