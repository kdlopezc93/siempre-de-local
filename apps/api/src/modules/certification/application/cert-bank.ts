import type { BankDraft, ExamConfig, PositionCode } from '@sdl/domain';

/**
 * Un banco de preguntas de una posición tal como se escribe en el repo (02 §6.2). Se
 * publica con `db:seed` solo si pasó la revisión de un entrenador (`review`, D10) y el
 * lint no tiene errores (02 §6.5). Una versión publicada es inmutable: corregir una
 * pregunta es otra versión (`label`).
 */
export interface CertBankContent extends BankDraft {
  position: PositionCode;
  /** Versión del banco de esa posición, p. ej. `v1`. */
  label: string;
  /** Quién lo revisó y cuándo (AAAA-MM-DD). null = borrador: no se publica. */
  review: { by: string; on: string } | null;
  /** Parámetros del examen si difieren de DEFAULT_EXAM_CONFIG. */
  config?: Partial<ExamConfig>;
}
