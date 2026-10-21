import { QuestionnaireResponseSchema } from '@sdl/contracts';

/** Cuestionario de prueba con la forma real de v2: 31 de posición, 20 por intento. */
export const uuid = (n: number) => `0192f0c4-7f6b-7c3e-9d1a-${n.toString(16).padStart(12, '0')}`;
export const POSITIONS = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'] as const;

/** 31 ítems con 4 opciones; la opción k de cada ítem da 3 puntos a POSITIONS[k + 4]. */
export const QUESTIONNAIRE = QuestionnaireResponseSchema.parse({
  versionId: uuid(1),
  label: 'v1',
  positionItemsPerAttempt: 20,
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
});
