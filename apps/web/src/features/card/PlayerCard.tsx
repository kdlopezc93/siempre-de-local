import type { MatchFormat, PlayerRating } from '@sdl/contracts';
import {
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  POSITIONS,
  RATING_ATTRIBUTES,
  type RatingAttributeCode,
} from '@sdl/domain';

import { RATED_ON, rankedAverages } from './card-view';
import styles from './PlayerCard.module.css';

type Card = Pick<PlayerRating, 'ratedAt' | 'values' | 'positionAverages'>;

/**
 * La ficha 0–99: su mejor media del formato en grande, los atributos y las medias por
 * posición. La comparten el jugador (su tarjeta) y el cuerpo técnico.
 */
export function PlayerCard({ card, format }: { card: Card; format: MatchFormat }) {
  const ranked = rankedAverages(card.positionAverages, format);
  const best = ranked[0];
  const hasGoalkeeper = card.values.GK_DIV !== undefined;
  return (
    <article className={styles.card} aria-label="Tarjeta del jugador">
      {best && (
        <header className={styles.head}>
          <p className={styles.overall}>
            <span className={styles.overallValue}>{best.value}</span>
            <span className={styles.overallPos}>
              <span className="sr-only">de media como </span>
              {POSITIONS[best.pos].name}
            </span>
          </p>
          <p className={styles.date}>Puntuada el {RATED_ON.format(new Date(card.ratedAt))}</p>
        </header>
      )}

      <Attributes codes={OUTFIELD_ATTRIBUTES} values={card.values} />
      {hasGoalkeeper && (
        <>
          <h2 className={styles.groupTitle}>De portero</h2>
          <Attributes codes={GOALKEEPER_ATTRIBUTES} values={card.values} />
        </>
      )}

      <h2 className={styles.groupTitle}>Media por posición</h2>
      <ol className={styles.averages}>
        {ranked.map(({ pos, value }, i) => (
          <li key={pos} className={i === 0 ? styles.top : undefined}>
            <span>{POSITIONS[pos].name}</span>
            <span className={styles.averageValue}>{value}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function Attributes({
  codes,
  values,
}: {
  codes: readonly RatingAttributeCode[];
  values: Card['values'];
}) {
  return (
    <dl className={styles.attributes}>
      {codes.map((code) => {
        const value = values[code] ?? 0;
        return (
          <div key={code} className={styles.attribute}>
            <dt>{RATING_ATTRIBUTES[code].name}</dt>
            <dd>
              <span className={styles.value}>{value}</span>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ transform: `scaleX(${value / 99})` }} />
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
