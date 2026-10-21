import { createHash } from 'node:crypto';

import type { SpikeQuestionnaire } from '@sdl/contracts';

/** Cuestionario de juguete: lo que importa es que viaje, se cachee y funcione offline. */
export const SPIKE_QUESTIONNAIRE: SpikeQuestionnaire = {
  version: 'spike-1',
  questions: [
    {
      id: 'q1',
      prompt: 'Recuperas la pelota en tu campo. ¿Qué haces primero?',
      options: [
        { id: 'a', label: 'Levanto la cabeza y busco el pase largo' },
        { id: 'b', label: 'Se la doy al compañero más cercano' },
        { id: 'c', label: 'Conduzco para ganar metros' },
      ],
    },
    {
      id: 'q2',
      prompt: 'Te toca marcar al delantero rival. ¿Dónde te paras?',
      options: [
        { id: 'a', label: 'Pegado a él, que sienta la marca' },
        { id: 'b', label: 'Un paso atrás, cuidando la espalda' },
        { id: 'c', label: 'Cerrando el pase hacia él' },
      ],
    },
    {
      id: 'q3',
      prompt: 'Quedan cinco minutos y vamos ganando. ¿Qué pides?',
      options: [
        { id: 'a', label: 'Tenerla y hacer correr al rival' },
        { id: 'b', label: 'Buscar el segundo gol' },
        { id: 'c', label: 'Juntarnos atrás' },
      ],
    },
  ],
};

/** ETag fuerte: cambia solo si cambia el contenido. */
export const SPIKE_QUESTIONNAIRE_ETAG = `"${createHash('sha256')
  .update(JSON.stringify(SPIKE_QUESTIONNAIRE))
  .digest('base64url')
  .slice(0, 16)}"`;
