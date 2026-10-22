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
}

export const CERT_EXAMS_REPOSITORY = Symbol('CERT_EXAMS_REPOSITORY');
