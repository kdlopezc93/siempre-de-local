import type { CertBankContent } from '../../../application/cert-bank.js';
import { qb, qLook } from './authoring.js';
import { MC_V1 } from './mc-v1.bank.js';

/**
 * Mediocentro, v2 (Fase 8): las 60 de v1 más las primeras preguntas de pizarra.
 * Lo revisó Kevin (D10, 2026-10-23). "Tú" eres el 8.
 */
const BOARD_ITEMS = [
  qb(
    'MC-PIZ-01',
    'apoyos',
    2,
    'Tu central tiene el balón y al pivote lo tienen tapado. ¿Dónde te ofreces?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 58, y: 120, label: '4' },
        { side: 'own', x: 36, y: 122, label: '2' },
        { side: 'own', x: 50, y: 100, label: '5' },
        { side: 'own', x: 66, y: 86, label: '8', you: true },
        { side: 'own', x: 90, y: 108, label: '6' },
        { side: 'rival', x: 50, y: 93, label: '10' },
        { side: 'rival', x: 56, y: 110, label: '9' },
      ],
      ball: { x: 60, y: 122 },
    },
    {
      label: 'Bajo al costado del pivote, al espacio libre, de cara al juego',
      spot: { x: 72, y: 102 },
    },
    [
      { label: 'Me quedo arriba, lejos, esperando que llegue', spot: { x: 76, y: 80 } },
      { label: 'Me pego al pivote para ayudarlo', spot: { x: 40, y: 98 } },
      { label: 'Me abro a la banda, pegado a la raya', spot: { x: 92, y: 90 } },
    ],
    'Con el pivote tapado, el mediocentro baja a dar una línea de pase libre al costado, de cara al juego. Lejos no ayuda; pegado al pivote, un solo rival los marca a los dos, y en la banda le quitas el lugar al lateral.',
  ),
  qLook(
    'MC-PIZ-02',
    'presion',
    2,
    'Acaban de perder el balón y el 6 rival lo recoge a dos metros tuyo. ¿Qué haces?',
    {
      view: 'rival-half',
      pieces: [
        { side: 'own', x: 52, y: 56, label: '8', you: true },
        { side: 'own', x: 50, y: 30, label: '9' },
        { side: 'own', x: 82, y: 40, label: '7' },
        { side: 'own', x: 30, y: 52, label: '10' },
        { side: 'rival', x: 58, y: 50, label: '6' },
        { side: 'rival', x: 40, y: 34, label: '4' },
        { side: 'rival', x: 70, y: 30, label: '5' },
        { side: 'rival', x: 34, y: 60, label: '8' },
      ],
      ball: { x: 60, y: 48 },
    },
    'Lo presiono enseguida, cerrándole el pase hacia el medio',
    [
      'Retrocedo a mi posición antes de que salgan',
      'Le doy espacio y espero que se equivoque',
      'Me tiro al suelo para robarla de una',
    ],
    'Recién perdida, el rival todavía no está ordenado: el más cercano presiona en el acto y le cierra el pase al medio para que la tenga que jugar hacia la banda o hacia atrás. Barrerse a dos metros es regalarle la salida.',
  ),
  qb(
    'MC-PIZ-03',
    'equilibrio',
    3,
    'Tu lateral derecho subió y perdieron el balón: el extremo rival arranca solo por la banda. ¿Dónde te ubicas?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 66, y: 88, label: '8', you: true },
        { side: 'own', x: 50, y: 102, label: '5' },
        { side: 'own', x: 62, y: 120, label: '4' },
        { side: 'own', x: 38, y: 120, label: '2' },
        { side: 'own', x: 80, y: 77, label: '6' },
        { side: 'rival', x: 86, y: 90, label: '11' },
        { side: 'rival', x: 52, y: 112, label: '9' },
      ],
      ball: { x: 87, y: 93 },
      arrows: [{ kind: 'dribble', from: { x: 87, y: 93 }, to: { x: 86, y: 108 } }],
    },
    {
      label: 'Cierro en diagonal hacia la banda para frenarlo mientras vuelve el lateral',
      spot: { x: 76, y: 102 },
    },
    [
      { label: 'Me meto al área a esperar el centro', spot: { x: 50, y: 134 } },
      { label: 'Me quedo en mi lugar, en el medio', spot: { x: 54, y: 80 } },
      { label: 'Lo persigo desde atrás', spot: { x: 94, y: 78 } },
    ],
    'Lo que equilibra es frenar al que lleva el balón desde adentro y en diagonal: no lo dejas entrar al centro y le das tiempo al lateral para volver. Perseguirlo desde atrás llega tarde; quedarte o meterte al área le deja toda la banda.',
  ),
  qb(
    'MC-PIZ-04',
    'transiciones',
    2,
    'Recuperas en el medio y el 7 ya arrancó a la espalda de su lateral. ¿A quién se la das?',
    {
      view: 'rival-half',
      pieces: [
        { side: 'own', x: 50, y: 62, label: '8', you: true },
        { side: 'own', x: 80, y: 42, label: '7' },
        { side: 'own', x: 50, y: 28, label: '9' },
        { side: 'own', x: 32, y: 46, label: '10' },
        { side: 'own', x: 14, y: 66, label: '3' },
        { side: 'rival', x: 54, y: 19 },
        { side: 'rival', x: 40, y: 39 },
        { side: 'rival', x: 66, y: 30 },
        { side: 'rival', x: 74, y: 50 },
      ],
      ball: { x: 53, y: 64 },
      arrows: [{ kind: 'run', from: { x: 80, y: 42 }, to: { x: 86, y: 18 } }],
    },
    { label: 'Al espacio, a la carrera del 7', spot: { x: 86, y: 20 } },
    [
      { label: 'Al pie del 9, de espaldas y con marca', spot: { x: 40, y: 20 } },
      { label: 'Al 10, que tiene un rival encima', spot: { x: 22, y: 40 } },
      { label: 'Atrás, al lateral', spot: { x: 22, y: 72 } },
    ],
    'En la transición, la primera mirada es hacia adelante: el 7 ya ganó la espalda y el pase al espacio lo deja solo. El 9 y el 10 tienen marca; volver al lateral le da tiempo al rival para ordenarse.',
  ),
];

export const MC_V2: CertBankContent = {
  ...MC_V1,
  label: 'v2',
  review: { by: 'Kevin Lopez', on: '2026-10-23' },
  items: [...MC_V1.items, ...BOARD_ITEMS],
};
