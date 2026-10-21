import { QuestionnaireResponseSchema } from '@sdl/contracts';

/** Cuestionario de prueba con la forma real: 31 de posición y 8 de preparación por posición. */
export const uuid = (n: number) => `0192f0c4-7f6b-7c3e-9d1a-${n.toString(16).padStart(12, '0')}`;
export const POSITIONS = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'] as const;

/** 31 ítems con 4 opciones; la opción k de cada ítem da 3 puntos a POSITIONS[k + 4]. */
export const QUESTIONNAIRE = QuestionnaireResponseSchema.parse({
  versionId: uuid(1),
  label: 'v1',
  positionItemsPerAttempt: 15,
  positionItems: Array.from({ length: 31 }, (_, i) => ({
    id: uuid(100 + i),
    code: `p${i + 1}`,
    context: i % 3 ? 'situation' : 'attribute',
    text: `Pregunta ${i + 1}`,
    options: Array.from({ length: 4 }, (_, k) => ({
      id: uuid(1000 + i * 10 + k),
      label: `Opción ${k}`,
      points: { [POSITIONS[k + 4]!]: 3 },
    })),
  })),
  prepItems: POSITIONS.flatMap((position, p) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: uuid(5000 + p * 10 + i),
      position,
      text: `${position} ${i + 1}`,
      options: Array.from({ length: 4 }, (_, k) => ({
        id: uuid(6000 + p * 100 + i * 10 + k),
        label: `R${k}`,
      })),
    })),
  ),
});
