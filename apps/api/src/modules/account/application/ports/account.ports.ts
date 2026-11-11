import type { AttemptResult, ExamResult, MyDataExport } from '@sdl/contracts';

/** Lo que el módulo de cuenta lee y borra directamente (lo implementa su infraestructura). */
export interface AccountRepository {
  account(userId: string): Promise<{ name: string; email: string; createdAt: Date } | null>;
  consents(userId: string): Promise<MyDataExport['consents']>;
  cardsAbout(userId: string): Promise<MyDataExport['cards']>;
  assessmentsAbout(userId: string): Promise<MyDataExport['assessments']>;
  /** Sus partidos: lo que respondió y cómo lo evaluaron (D18). */
  matchesOf(userId: string): Promise<MyDataExport['matches']>;
  /** Sus cobros y pagos, y las partes que patrocina (2026-11-06). */
  chargesOf(userId: string): Promise<MyDataExport['charges']>;
  /** Clubes donde es el único dueño o admin: borrarlo los dejaría sin nadie que los maneje. */
  clubsOnlyManagedBy(userId: string): Promise<string[]>;
  /**
   * Borra la cuenta: en cascada todo lo suyo (perfil, tests, exámenes, tarjetas y valoraciones
   * sobre él, membresías, sesiones, consentimientos); lo que hizo sobre otros queda sin autor.
   * En la misma transacción, los menores que solo tenían a esta persona de acudiente (2026-11-10:
   * un niño no queda en la app sin nadie que lo maneje). Devuelve cuántos menores se borraron.
   */
  deleteUser(userId: string): Promise<{ minors: number }>;
  /** El menor a cargo de ese acudiente (su nombre), o null si no es suyo (2026-11-10). */
  minorOf(guardianUserId: string, minorUserId: string): Promise<{ name: string } | null>;
}

/** Sus tests de orientación (lo implementa quiz). */
export interface MyAttemptsQuery {
  list(userId: string): Promise<AttemptResult[]>;
}

/** Sus exámenes de conocimiento, solo resultados (lo implementa certification). */
export interface MyExamsQuery {
  myExams(userId: string): Promise<ExamResult[]>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
export const MY_ATTEMPTS_QUERY = Symbol('MY_ATTEMPTS_QUERY');
export const MY_EXAMS_QUERY = Symbol('MY_EXAMS_QUERY');
