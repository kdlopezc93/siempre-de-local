import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';
import type { CSSProperties } from 'react';

import { Pitch } from '../../shared/ui/Pitch';
import { POSITION_COPY } from './position-copy';
import styles from './ResultView.module.css';

export interface ResultData {
  format: MatchFormat;
  /** Las 3 del podio, de mayor a menor afinidad. */
  podium: readonly { pos: PositionCode; pct: number }[];
  /** true mientras no llega el oficial (calculado en el celular, sin señal). */
  provisional: boolean;
}

const percent = (pct: number) => `${Math.round(pct * 100)}%`;

/**
 * Tus 3 posiciones: la primera con su dorsal y su descripción, la pizarra con el podio
 * marcado y el podio con la afinidad. El podio se revela de la 3.ª a la 1.ª.
 */
export function ResultView({ format, podium, provisional }: ResultData) {
  const [first] = podium;
  if (!first) return null;
  const copy = POSITION_COPY[first.pos];
  const names = podium.map((entry) => POSITIONS[entry.pos].name);

  return (
    <article className={styles.result}>
      <p className={styles.eyebrow}>{provisional ? 'Tu podio provisional' : 'Tus 3 posiciones'}</p>
      <header className={styles.head}>
        <span className={styles.number} aria-hidden="true">
          {POSITIONS[first.pos].number}
        </span>
        <div>
          <h1 className={styles.name}>{POSITIONS[first.pos].name}</h1>
          <p className={styles.tagline}>{copy.tagline}</p>
        </div>
      </header>
      <p className={styles.description}>{copy.description}</p>

      <div className={styles.board}>
        <Pitch
          format={format}
          marked={podium.map((entry) => entry.pos)}
          label={`Cancha con tus posiciones marcadas: ${names.join(', ')}`}
        />
      </div>

      <section aria-labelledby="podium-title">
        <h2 id="podium-title" className={styles.sectionTitle}>
          Tu podio
        </h2>
        <ol className={styles.podium}>
          {podium.map((entry, i) => (
            <li
              key={entry.pos}
              className={styles.row}
              // De la 3.ª a la 1.ª: la primera aparece al final.
              style={{ '--reveal': podium.length - 1 - i } as CSSProperties}
            >
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.rowName}>{POSITIONS[entry.pos].name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ transform: `scaleX(${entry.pct})` }} />
              </span>
              <span className={styles.pct}>{percent(entry.pct)}</span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>
          La afinidad compara tus respuestas con lo que pide cada posición. No sirve para compararte
          con otro jugador.
        </p>
      </section>

      <p className={styles.next}>
        Muy pronto vas a poder certificarte en cualquiera de las tres con un examen de conocimiento
        de la posición.
      </p>
      <p className={styles.note}>Es una orientación, no un veredicto.</p>
    </article>
  );
}
