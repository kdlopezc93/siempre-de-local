import type { PositionCode } from '@sdl/domain';

/** Una versión publicada completa, tal como la usa el servidor (con las correctas). */
export interface QuestionnaireContent {
  versionId: string;
  label: string;
  positionItemsPerAttempt: number;
  positionItems: {
    id: string;
    code: string;
    context: 'situation' | 'attribute';
    text: string;
    options: { id: string; label: string; points: Partial<Record<PositionCode, number>> }[];
  }[];
  prepItems: {
    id: string;
    position: PositionCode;
    text: string;
    options: { id: string; label: string; isCorrect: boolean }[];
  }[];
}

export interface QuestionnaireReader {
  /** Versión publicada vigente (la más reciente), o null si no hay ninguna. */
  currentPublishedId(): Promise<string | null>;
  /** Contenido de una versión publicada o retirada; null si no existe o es borrador. */
  load(versionId: string): Promise<QuestionnaireContent | null>;
}

export const QUESTIONNAIRE_READER = Symbol('QUESTIONNAIRE_READER');
