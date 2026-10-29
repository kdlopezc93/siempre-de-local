import type { MatchFormat, PlayerRating } from '@sdl/contracts';
import {
  anchorFor,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  POSITIONS,
  RATING_ATTRIBUTES,
  type RatingAttributeCode,
} from '@sdl/domain';

import { cardHeadline, RATED_ON, rankedAverages } from './card-view';
import styles from './PlayerCard.module.css';

type Card = Pick<PlayerRating, 'ratedAt' | 'position' | 'values' | 'positionAverages'>;

/**
 * La ficha 0–99: en grande, la posición que le puso quien puntuó con su media (o su mejor
 * media, en las fotos de antes; 02 §7.4), los atributos y las medias por posición. La
 * comparten el jugador (su tarjeta) y el cuerpo técnico.
 */
export function PlayerCard({
  card,
  format,
  headingLevel = 2,
}: {
  card: Card;
  format: MatchFormat;
  /** Nivel de sus subtítulos: 3 si la ficha va dentro de una sección con h2. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const ranked = rankedAverages(card.positionAverages, format);
  const headline = cardHeadline(card, format);
  const hasGoalkeeper = card.values.GK_DIV !== undefined;
  return (
    <article className={styles.card} aria-label="Tarjeta del jugador">
      {headline && (
        <header className={styles.head}>
          <p className={styles.overline} aria-hidden="true">
            {headline.chosen ? 'Su posición' : 'Mejor media'}
          </p>
          <p className={styles.overall}>
            <span className={styles.overallValue}>{headline.main.value}</span>
            <span className={styles.overallPos}>
              <span className="sr-only">de media como </span>
              {POSITIONS[headline.main.pos].name}
            </span>
          </p>
          {headline.best && (
            <p className={styles.best}>
              Su mejor media: {POSITIONS[headline.best.pos].name}{' '}
              <span className={styles.bestValue}>{headline.best.value}</span>
            </p>
          )}
          <p className={styles.date}>Puntuada el {RATED_ON.format(new Date(card.ratedAt))}</p>
        </header>
      )}

      <div className={styles.panel}>
        <Attributes codes={OUTFIELD_ATTRIBUTES} values={card.values} />
        {hasGoalkeeper && (
          <>
            <Heading className={styles.groupTitle}>De portero</Heading>
            <Attributes codes={GOALKEEPER_ATTRIBUTES} values={card.values} />
          </>
        )}
      </div>

      <div className={styles.panel}>
        <Heading className={styles.groupTitle}>Media por posición</Heading>
        <ol className={styles.averages}>
          {ranked.map(({ pos, value }) => (
            <li key={pos} className={pos === headline?.main.pos ? styles.top : undefined}>
              <span>{POSITIONS[pos].name}</span>
              <span className={styles.averageValue}>{value}</span>
            </li>
          ))}
        </ol>
      </div>
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
          // El color de la barra dice el nivel, como al puntuar (carencia, por debajo, medio, destaca).
          <div key={code} className={styles.attribute} data-band={anchorFor(value).min}>
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
