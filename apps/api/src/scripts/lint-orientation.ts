import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { lintOrientation, ORIENTATION_COVERAGE, orientationCoverage, POSITIONS } from '@sdl/domain';

import { orientationReviewSheet } from '../modules/questionnaires/application/orientation-report.js';
import { ORIENTATION_V2 } from '../modules/questionnaires/infrastructure/seed/orientation-v2.content.js';
import { ORIENTATION_V3 } from '../modules/questionnaires/infrastructure/seed/orientation-v3.content.js';

/**
 * pnpm quiz:lint [-- --md <carpeta>]
 *
 * Control de calidad del test de orientación (02 §2): estructura de cada pregunta y cuántas
 * apuntan a cada posición, en el banco y por intento. Sale con error si hay errores de
 * estructura (no se podría publicar); los avisos de cobertura no bloquean. Con `--md`, escribe
 * la hoja de revisión de cada versión nueva frente a la anterior.
 */
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { md: { type: 'string' } },
});

const VERSIONS = [ORIENTATION_V2, ORIENTATION_V3];

let blocking = 0;
for (const version of VERSIONS) {
  const issues = lintOrientation(version);
  const lines = [
    `Test de orientación ${version.label}: ${version.positionItems.length} preguntas, ${version.positionItemsPerAttempt} por intento`,
    '',
    '  Posición                 Suman  Apuntan  Por intento*',
    ...orientationCoverage(version).map(
      (c) =>
        `  ${POSITIONS[c.position].name.padEnd(24)} ${String(c.scoring).padStart(5)}  ${String(c.strong).padStart(7)}  ${String(c.strongPerAttemptP10).padStart(12)}`,
    ),
    '',
    `  * Las que apuntan a la posición en el 10 % de intentos con menos. Se buscan ${ORIENTATION_COVERAGE.minStrongItems} en el banco y ${ORIENTATION_COVERAGE.minStrongPerAttemptP10} por intento.`,
    '',
    ...(issues.length === 0
      ? ['  Sin problemas.']
      : issues.map(
          (i) =>
            `  ${i.level === 'error' ? 'ERROR' : 'aviso'} ${i.item ? `[${i.item}] ` : ''}${i.message}`,
        )),
  ];
  console.log(`${lines.join('\n')}\n`);
  if (issues.some((i) => i.level === 'error')) blocking++;
  const previous = VERSIONS[VERSIONS.indexOf(version) - 1];
  if (values.md && previous) {
    mkdirSync(values.md, { recursive: true });
    const file = `${values.md}/orientacion-${version.label}.md`;
    writeFileSync(file, orientationReviewSheet(version, previous));
    console.log(`  Hoja de revisión: ${file}\n`);
  }
}
process.exitCode = blocking > 0 ? 1 : 0;
