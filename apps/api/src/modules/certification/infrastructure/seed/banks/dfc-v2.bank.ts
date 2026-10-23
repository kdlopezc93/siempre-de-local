import type { CertBankContent } from '../../../application/cert-bank.js';
import { qb, qLook } from './authoring.js';
import { DFC_V1 } from './dfc-v1.bank.js';

/**
 * Defensa central, v2 (BORRADOR, Fase 8): las 60 de v1 más las primeras preguntas de pizarra.
 * Se publica cuando las revise el entrenador revisor (D10). Coordenadas de la cancha de
 * siempre (100×150, tu arco abajo); "tú" es el 4 o el 2, según la jugada.
 */
const BOARD_ITEMS = [
  qb(
    'DFC-PIZ-01',
    'marcaje',
    2,
    'El 9 rival va a recibir de espaldas en la puerta del área. ¿Dónde te paras?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 62, y: 132, label: '4', you: true },
        { side: 'own', x: 36, y: 128, label: '2' },
        { side: 'own', x: 12, y: 118, label: '3' },
        { side: 'own', x: 88, y: 118, label: '6' },
        { side: 'own', x: 44, y: 92, label: '5' },
        { side: 'rival', x: 52, y: 106, label: '9' },
        { side: 'rival', x: 34, y: 86, label: '8' },
        { side: 'rival', x: 82, y: 92, label: '7' },
      ],
      ball: { x: 35, y: 89 },
      arrows: [{ kind: 'pass', from: { x: 36, y: 89 }, to: { x: 51, y: 103 } }],
    },
    { label: 'Pegado a su espalda, sin dejarlo girar', spot: { x: 54, y: 116 } },
    [
      { label: 'Adelante del 9, para anticipar el pase', spot: { x: 60, y: 96 } },
      { label: 'A un costado, cerrándole el giro hacia afuera', spot: { x: 74, y: 108 } },
      { label: 'Atrás, en el punto de penal, esperándolo', spot: { x: 48, y: 138 } },
    ],
    'De espaldas al arco es menos peligroso: pegado a él le impides girar y lo obligas a jugar hacia atrás. Si sales a anticipar y no llegas, te gana la espalda; de costado o lejos, gira y te encara.',
  ),
  qLook(
    'DFC-PIZ-02',
    'linea',
    3,
    'Nadie presiona al 8 rival, que levanta la cabeza, y el 9 amaga con picar a tu espalda. La línea está pareja. ¿Qué hace la línea?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 15, y: 108, label: '3' },
        { side: 'own', x: 38, y: 108, label: '2' },
        { side: 'own', x: 61, y: 108, label: '4', you: true },
        { side: 'own', x: 85, y: 108, label: '6' },
        { side: 'own', x: 50, y: 140, label: '1' },
        { side: 'rival', x: 66, y: 103, label: '9' },
        { side: 'rival', x: 48, y: 82, label: '8' },
      ],
      ball: { x: 48, y: 86 },
      arrows: [{ kind: 'run', from: { x: 66, y: 103 }, to: { x: 72, y: 124 } }],
    },
    'Retrocede unos pasos junta: con el balón sin presión, se cuida la espalda',
    [
      'Sube junta para dejar al 9 en fuera de juego',
      'Cada uno se queda donde está y levanta la mano',
      'Sales tú solo a presionar al 8',
    ],
    'Con el balón "descubierto" (nadie presiona al que lo tiene), puede filtrar el pase cuando quiera: la línea retrocede junta y cuida la espalda. Subir solo funciona si alguien lo presiona; quedarse pidiendo fuera de juego es jugársela al banderín.',
  ),
  qb(
    'DFC-PIZ-03',
    'coberturas',
    2,
    'Tu lateral izquierdo salió a presionar al extremo en la banda. ¿Dónde te ubicas?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 40, y: 118, label: '2', you: true },
        { side: 'own', x: 66, y: 120, label: '4' },
        { side: 'own', x: 16, y: 104, label: '3' },
        { side: 'own', x: 86, y: 112, label: '6' },
        { side: 'rival', x: 13, y: 95, label: '11' },
        { side: 'rival', x: 54, y: 106, label: '9' },
      ],
      ball: { x: 15, y: 97 },
      arrows: [{ kind: 'run', from: { x: 16, y: 104 }, to: { x: 15, y: 99 } }],
    },
    {
      label: 'Me corro hacia afuera, por detrás de mi lateral, para cubrirlo',
      spot: { x: 27, y: 113 },
    },
    [
      { label: 'Me quedo en el centro, encima del 9', spot: { x: 50, y: 120 } },
      { label: 'Salgo yo también a presionar al extremo', spot: { x: 27, y: 90 } },
      { label: 'Retrocedo hasta el área chica', spot: { x: 42, y: 138 } },
    ],
    'Cuando el lateral sale, el central más cercano cubre su espalda en diagonal: si el extremo lo supera, llegas tú. El otro central toma al 9 y la línea se corre hacia el balón.',
  ),
  qb(
    'DFC-PIZ-04',
    'salida',
    2,
    'Tienes el balón y te presionan arriba. ¿A quién se la das?',
    {
      view: 'own-half',
      pieces: [
        { side: 'own', x: 62, y: 122, label: '4', you: true },
        { side: 'own', x: 50, y: 144, label: '1' },
        { side: 'own', x: 34, y: 122, label: '2' },
        { side: 'own', x: 88, y: 106, label: '6' },
        { side: 'own', x: 52, y: 100, label: '5' },
        { side: 'own', x: 12, y: 108, label: '3' },
        { side: 'rival', x: 38, y: 112, label: '9' },
        { side: 'rival', x: 55, y: 90, label: '10' },
        { side: 'rival', x: 14, y: 100, label: '7' },
        { side: 'rival', x: 64, y: 112, label: '11' },
      ],
      ball: { x: 64, y: 125 },
    },
    { label: 'Al lateral derecho, que está libre', spot: { x: 82, y: 97 } },
    [
      { label: 'Al otro central', spot: { x: 26, y: 130 } },
      { label: 'Al pivote, de espaldas y con marca', spot: { x: 42, y: 96 } },
      { label: 'Un pelotazo al delantero', spot: { x: 50, y: 82 } },
    ],
    'La mejor salida es el compañero libre y de cara: el lateral recibe sin presión y con el campo de frente. El otro central y el pivote tienen un rival encima, y el pelotazo casi siempre regala el balón.',
  ),
];

export const DFC_V2: CertBankContent = {
  ...DFC_V1,
  label: 'v2',
  review: null,
  items: [...DFC_V1.items, ...BOARD_ITEMS],
};
