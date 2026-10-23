import {
  orientationCoverage,
  ORIENTATION_COVERAGE,
  POSITIONS,
  type PositionCode,
} from '@sdl/domain';

import type { OrientationContent } from './orientation-content.js';

type Item = OrientationContent['positionItems'][number];

const CONTEXT = { situation: 'Situación', attribute: 'Cómo eres' } as const;

const pointsInWords = (points: Partial<Record<PositionCode, number>>) =>
  Object.entries(points)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(([pos, value]) => `${POSITIONS[pos as PositionCode].name} ${value}`)
    .join(' · ');

const itemBlock = (item: Item) => [
  `### ${item.code} · ${CONTEXT[item.context]}`,
  '',
  `**${item.text}**`,
  '',
  '| Opción | Suma a |',
  '|---|---|',
  ...item.options.map((o) => `| ${o.label} | ${pointsInWords(o.points)} |`),
  '',
];

/**
 * La hoja de revisión de una versión nueva del test (Fase 8): qué cambia frente a la anterior,
 * cada pregunta nueva con lo que suma cada opción y la cobertura por posición antes y después.
 * Se genera con `pnpm quiz:lint -- --md docs/test`; no se edita a mano.
 */
export function orientationReviewSheet(
  draft: OrientationContent,
  previous: OrientationContent,
): string {
  const before = new Map(previous.positionItems.map((i) => [i.code, i]));
  const added = draft.positionItems.filter((i) => !before.has(i.code));
  const changed = draft.positionItems.filter((i) => {
    const old = before.get(i.code);
    return old && JSON.stringify(old) !== JSON.stringify(i);
  });
  const covBefore = new Map(orientationCoverage(previous).map((c) => [c.position, c]));

  return [
    `# Test de orientación ${draft.label}: hoja de revisión`,
    '',
    draft.review
      ? `> Revisada por ${draft.review.reviewedBy} el ${draft.review.reviewedOn}.`
      : '> **Borrador.** No se publica hasta que la revises.',
    '',
    `${draft.positionItems.length} preguntas (${previous.label} tenía ${previous.positionItems.length}); cada intento sirve ${draft.positionItemsPerAttempt} al azar.`,
    '',
    '## Cómo revisar',
    '',
    'En este test **no hay respuestas correctas**: cada opción suma puntos a las posiciones que describe. Lee cada pregunta como un jugador de tu equipo y anota al lado del código (p. ej. `p34`):',
    '',
    '- una opción **no describe** a las posiciones a las que suma (o suma a una que no corresponde);',
    '- una opción **suena mejor** que las otras ("la correcta"): el jugador la elegiría por quedar bien, no porque juega así;',
    '- la pregunta **no se entiende**, usa palabras que en tu liga no se dicen, o se parece demasiado a otra;',
    '- falta una opción que un jugador real elegiría.',
    '',
    'Mándame las notas (comentarios en el PR, un mensaje o fotos de la hoja marcada). Con tu visto bueno se publica.',
    '',
    '## Cobertura por posición',
    '',
    `Cuántas preguntas **apuntan** a cada posición (alguna opción le da 3 puntos o más y es la que más recibe) y cuántas le tocan en el 10 % de intentos con menos. Se buscan ${ORIENTATION_COVERAGE.minStrongItems} y ${ORIENTATION_COVERAGE.minStrongPerAttemptP10}.`,
    '',
    `| Posición | Apuntan (${previous.label} → ${draft.label}) | Por intento (${previous.label} → ${draft.label}) |`,
    '|---|---|---|',
    ...orientationCoverage(draft).map((c) => {
      const old = covBefore.get(c.position)!;
      return `| ${POSITIONS[c.position].name} | ${old.strong} → ${c.strong} | ${old.strongPerAttemptP10} → ${c.strongPerAttemptP10} |`;
    }),
    '',
    ...(changed.length
      ? [
          `## Cambian frente a ${previous.label}`,
          '',
          ...changed.flatMap((item) => [
            `- **${item.code}:** "${before.get(item.code)!.text}" → "${item.text}"`,
          ]),
          '',
        ]
      : []),
    `## Preguntas nuevas (${added.length})`,
    '',
    ...added.flatMap(itemBlock),
  ].join('\n');
}
