import type { CertBankContent } from '../modules/certification/application/cert-bank.js';

const AREAS = [
  { code: 'marcaje', name: 'Marcaje' },
  { code: 'linea', name: 'Línea defensiva y fuera de juego' },
  { code: 'aereo', name: 'Juego aéreo' },
];

/** Un banco válido de `count` ítems (dificultades 3/5/2 de cada 10), para tests. */
export function certBankFixture(count = 40, over: Partial<CertBankContent> = {}): CertBankContent {
  return {
    position: 'DFC',
    label: 'v1',
    review: { by: 'Profe Revisor', on: '2026-10-22' },
    areas: AREAS,
    items: Array.from({ length: count }, (_, i) => ({
      code: `DFC-${String(i + 1).padStart(2, '0')}`,
      area: AREAS[i % AREAS.length]!.code,
      difficulty: ([1, 1, 1, 2, 2, 2, 2, 2, 3, 3] as const)[i % 10]!,
      text: `Situación de prueba ${i + 1}`,
      options: [
        { label: `Correcta ${i}`, correct: true },
        { label: `Distractor A ${i}` },
        { label: `Distractor B ${i}` },
        { label: `Distractor C ${i}` },
      ],
      explanation: 'Porque es lo que pide la posición.',
    })),
    ...over,
  };
}
