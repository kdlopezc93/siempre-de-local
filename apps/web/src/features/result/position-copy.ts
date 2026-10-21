import type { PositionCode } from '@sdl/contracts';

/** Cómo se presenta cada posición en el resultado (textos del prototipo, en segunda persona). */
export const POSITION_COPY: Record<PositionCode, { tagline: string; description: string }> = {
  POR: {
    tagline: 'El último recurso',
    description:
      'Vives de la concentración, la colocación y la seguridad bajo palos. En el fútbol de hoy también mandas la salida de balón con los pies.',
  },
  LAT: {
    tagline: 'El motor de la banda',
    description:
      'Defiendes y atacas. Das amplitud arriba y cierras la espalda atrás. Tu fuerte es el fondo físico y el criterio para subir y bajar.',
  },
  DFC: {
    tagline: 'El muro',
    description:
      'Anticipas, ganas duelos y ordenas la última línea. Tu seguridad le da equilibrio a todo el equipo, con balón y sin él.',
  },
  MCD: {
    tagline: 'El equilibrio',
    description:
      'Proteges a la defensa, recuperas y ordenas el juego desde atrás. Sin ruido, pero imprescindible: eres la brújula del equipo.',
  },
  MC: {
    tagline: 'El pulmón',
    description:
      'Llegas a todo: defiendes, distribuyes y apareces en ataque desde segunda línea. La cancha entera es tu zona de trabajo.',
  },
  MP: {
    tagline: 'El cerebro creativo',
    description:
      'Juegas entre líneas y ves el pase que otros no ven. Eres la chispa: asociación, último pase y desmarque para crear ocasiones.',
  },
  EXT: {
    tagline: 'El desequilibrio',
    description:
      'Vives del uno contra uno, la velocidad y el desborde. Rompes defensas por fuera y por dentro, y llegas a rematar al área.',
  },
  DC: {
    tagline: 'El finalizador',
    description:
      'Vives del gol: desmarque, colocación y sangre fría en el área. Tu trabajo se mide en la red, y arrastras marcas para el equipo.',
  },
};
