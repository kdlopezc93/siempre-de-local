// Extrae el contenido del test de orientación de docs/prototipo/detector-posicion.jsx
// y escribe orientation-v1.content.ts. Reproducible: el test de paridad lo vuelve a correr.
//
//   node apps/api/scripts/extract-prototype-content.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = `${ROOT}docs/prototipo/detector-posicion.jsx`;
const TARGET = `${ROOT}apps/api/src/modules/questionnaires/infrastructure/seed/orientation-v1.content.ts`;

const CONTEXT = { Situación: 'situation', Atributo: 'attribute' };

/** Evalúa el literal `const NAME = …;` del prototipo (es nuestro propio archivo de datos). */
function literal(source, name, closing) {
  const start = source.indexOf(`const ${name} = `);
  const end = source.indexOf(`\n${closing};\n`, start);
  if (start < 0 || end < 0) throw new Error(`No encontré ${name} en el prototipo`);
  return new Function(`return ${source.slice(start + `const ${name} = `.length, end + 2)}`)();
}

/** Barajado determinista: en el prototipo la correcta siempre iba primera (06, deuda). */
function seededShuffle(items, seed) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function extract() {
  const source = readFileSync(SOURCE, 'utf8');
  const positionQuestions = literal(source, 'POSITION_QUESTIONS', ']');
  const prep = literal(source, 'PREP', '}');

  return {
    label: 'v1',
    positionItemsPerAttempt: 15,
    positionItems: positionQuestions.map((q) => ({
      code: q.id,
      context: CONTEXT[q.ctx],
      text: q.text,
      options: q.options.map((o) => ({ label: o.label, points: o.pts })),
    })),
    prepItems: Object.fromEntries(
      Object.entries(prep).map(([position, items]) => [
        position,
        items.map((item, i) => ({
          text: item.q,
          options: seededShuffle(
            item.opts.map((label, j) => ({ label, isCorrect: j === item.c })),
            position.charCodeAt(0) * 100 + i,
          ),
        })),
      ]),
    ),
  };
}

export function render(content) {
  return `// GENERADO por apps/api/scripts/extract-prototype-content.mjs desde docs/prototipo/detector-posicion.jsx.
// No editar a mano: el contenido publicado es inmutable; los cambios van en una versión nueva.
import type { OrientationContent } from '../../application/orientation-content.js';

export const ORIENTATION_V1: OrientationContent = ${JSON.stringify(content, null, 2)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = render(extract());
  if (process.argv.includes('--check')) {
    if (readFileSync(TARGET, 'utf8') !== output) {
      console.error('orientation-v1.content.ts no coincide con el prototipo');
      process.exit(1);
    }
  } else {
    writeFileSync(TARGET, output);
    console.log(`Escrito ${TARGET}`);
  }
}
