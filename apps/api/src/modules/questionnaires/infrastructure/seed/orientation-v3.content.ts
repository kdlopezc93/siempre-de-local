import type { OrientationContent } from '../../application/orientation-content.js';
import { ORIENTATION_V1 } from './orientation-v1.content.js';

type Item = OrientationContent['positionItems'][number];

/** p28 decía "vosotros" (español de España): en v3, "ustedes". */
const p28: Item = {
  ...ORIENTATION_V1.positionItems.find((item) => item.code === 'p28')!,
  text: 'Van ganando y el rival se vuelca al ataque. Tú:',
};

/**
 * Las nueve nuevas (Fase 8): para Lateral, Mediocentro y Extremo, que en v2 tenían pocas
 * preguntas que apuntaran a ellas (`pnpm quiz:lint`). El mediocentro es el que va y vuelve de
 * área a área, conduce y rompe líneas; el pivote, el que se queda ubicado y corta.
 */
const NEW_ITEMS: Item[] = [
  {
    code: 'p32',
    context: 'situation',
    text: 'Tu extremo se mete hacia adentro con el balón y deja libre la banda. Tú:',
    options: [
      {
        label: 'Subo por fuera a toda velocidad para ofrecerle el pase',
        points: { LAT: 3, EXT: 1 },
      },
      { label: 'Me acerco por dentro para tirar la pared', points: { MC: 3, MP: 1 } },
      { label: 'Me quedo atrás cuidando el contraataque', points: { MCD: 2, DFC: 1 } },
      { label: 'Ataco el área para esperar el centro', points: { DC: 3 } },
    ],
  },
  {
    code: 'p33',
    context: 'situation',
    text: 'El rival ataca por una banda con dos jugadores contra uno de los tuyos. Tú:',
    options: [
      {
        label: 'Me quedo entre los dos y hago tiempo hasta que llegue la ayuda',
        points: { LAT: 3, DFC: 1 },
      },
      { label: 'Bajo desde el medio a doblar la marca', points: { MC: 3, MCD: 2 } },
      { label: 'Cierro el centro del área por si llega el pase atrás', points: { DFC: 3 } },
      {
        label: 'Me quedo arriba esperando la recuperación para salir rápido',
        points: { EXT: 2, DC: 1 },
      },
    ],
  },
  {
    code: 'p34',
    context: 'attribute',
    text: '¿Qué tipo de esfuerzo te sale más natural?',
    options: [
      { label: 'Subir y bajar la banda todo el partido', points: { LAT: 4 } },
      { label: 'Ir y volver de área a área por el medio', points: { MC: 4 } },
      { label: 'Pocos movimientos, pero siempre bien ubicado', points: { MCD: 2, DFC: 2, POR: 1 } },
      { label: 'Arranques cortos y explosivos cerca del área', points: { DC: 2, EXT: 2 } },
    ],
  },
  {
    code: 'p35',
    context: 'situation',
    text: 'Tu equipo tiene el balón en campo rival y al pivote lo tienen marcado. Tú:',
    options: [
      {
        label: 'Bajo al lado del pivote para recibir, girarme y avanzar',
        points: { MC: 3, MCD: 1 },
      },
      { label: 'Me abro pegado a la raya para dar amplitud', points: { LAT: 3, EXT: 2 } },
      { label: 'Me ofrezco entre líneas, a la espalda de sus volantes', points: { MP: 3 } },
      { label: 'Fijo a los centrales para que no salgan a presionar', points: { DC: 3 } },
    ],
  },
  {
    code: 'p36',
    context: 'situation',
    text: 'Llega un centro a tu área desde la banda contraria. ¿Dónde estás?',
    options: [
      { label: 'Cerrando el segundo palo por detrás del delantero', points: { LAT: 3, DFC: 1 } },
      { label: 'Marcando al nueve en el punto de penal', points: { DFC: 3 } },
      { label: 'En la puerta del área, atento al rebote', points: { MC: 3, MCD: 2 } },
      { label: 'Saliendo a cortar el centro', points: { POR: 4 } },
    ],
  },
  {
    code: 'p37',
    context: 'situation',
    text: 'Recibes en la mitad de la cancha con espacio para conducir. Tú:',
    options: [
      { label: 'Conduzco y rompo la primera línea de presión', points: { MC: 3, MCD: 1 } },
      { label: 'La suelto rápido al pie de un compañero cercano', points: { MCD: 3, MC: 1 } },
      {
        label: 'Levanto la cabeza y busco el pase al espacio para el nueve',
        points: { MP: 3, MC: 1 },
      },
      { label: 'Me la llevo hacia la banda para encarar', points: { EXT: 3, LAT: 1 } },
    ],
  },
  {
    code: 'p38',
    context: 'situation',
    text: 'Recibes pegado a la raya y el lateral rival te espera. Tú:',
    options: [
      { label: 'Lo encaro por fuera y busco la línea de fondo', points: { EXT: 4 } },
      {
        label: 'Me meto hacia adentro buscando mi pie bueno para patear',
        points: { MP: 3, EXT: 2 },
      },
      { label: 'Freno, la cuido y espero que pase alguien por fuera', points: { EXT: 2, MC: 1 } },
      { label: 'La devuelvo atrás para que el equipo arme de nuevo', points: { MCD: 2, MC: 2 } },
    ],
  },
  {
    code: 'p39',
    context: 'attribute',
    text: 'Después de un partido, lo que más te gusta que te digan es:',
    options: [
      { label: 'Por tu banda no pasó nadie', points: { LAT: 3, DFC: 1 } },
      { label: 'Estuviste en todos lados', points: { MC: 4 } },
      { label: 'Ordenaste al equipo desde atrás', points: { DFC: 2, POR: 2, MCD: 1 } },
      { label: 'Desequilibraste cada vez que la tocaste', points: { EXT: 3, MP: 1 } },
    ],
  },
  {
    code: 'p40',
    context: 'situation',
    text: 'Pierdes el balón cerca de la banda, en la mitad de la cancha. Tú:',
    options: [
      {
        label: 'Corro hacia atrás por mi carril para recuperar la posición',
        points: { LAT: 3, EXT: 1 },
      },
      { label: 'Presiono de inmediato al que me la robó', points: { MC: 3, EXT: 2 } },
      { label: 'Cierro por dentro el pase al medio', points: { MCD: 3 } },
      { label: 'Aviso y acomodo a los de atrás', points: { DFC: 2, POR: 2 } },
    ],
  },
];

/**
 * v3 (BORRADOR, Fase 8): las 31 de v2 (p28 en "ustedes") más nueve nuevas, 20 por intento.
 * No se publica hasta que Kevin la revise (`review`): la hoja está en `docs/test/`.
 */
export const ORIENTATION_V3: OrientationContent = {
  label: 'v3',
  positionItemsPerAttempt: 20,
  positionItems: [
    ...ORIENTATION_V1.positionItems.map((item) => (item.code === 'p28' ? p28 : item)),
    ...NEW_ITEMS,
  ],
  prepItems: {},
  review: null,
};
