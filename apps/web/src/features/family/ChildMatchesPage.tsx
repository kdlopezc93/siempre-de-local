import type { Match } from '@sdl/contracts';
import { useEffect } from 'react';

import { Badge } from '../../shared/ui/Badge';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import type { HeaderKid } from '../../shared/ui/TeamHeader';
import { matchTitle, matchWhen, splitMatches } from '../matches/match-view';
import { CallCard } from './CallCard';
import styles from './Family.module.css';
import { useChildMatches } from './use-family';

/**
 * /deportistas/:minorId/equipos/:teamId/partidos[/:matchId] — los partidos y entrenos del niño:
 * los próximos se responden ahí; de los jugados, solo el marcador (sin goleadores ni tablas: es
 * un menor). `matchId` (del aviso) lleva a ese partido.
 */
export function ChildMatchesPage({ seat, matchId }: { seat: HeaderKid; matchId?: string }) {
  const matches = useChildMatches(seat.id, seat.teamId);
  const loaded = matches.isSuccess;

  useEffect(() => {
    if (!loaded || !matchId) return;
    document.getElementById(`call-${matchId}`)?.closest('article, li')?.scrollIntoView({
      block: 'center',
    });
  }, [loaded, matchId]);

  return (
    <Screen className={styles.screen}>
      <PageTitle eyebrow={seat.name} title="Partidos y entrenos" />
      {matches.isPending ? (
        <p className="sr-only" role="status">
          Cargando los partidos…
        </p>
      ) : matches.isError ? (
        <p role="alert" className={styles.muted}>
          No pudimos cargar los partidos. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : (
        <Lists seat={seat} items={matches.data.items} focused={matchId} />
      )}
    </Screen>
  );
}

function Lists({
  seat,
  items,
  focused,
}: {
  seat: HeaderKid;
  items: Match[];
  focused: string | undefined;
}) {
  const { upcoming, past } = splitMatches(items);
  if (items.length === 0) {
    return <p className={styles.muted}>Todavía no hay partidos ni entrenos convocados.</p>;
  }
  return (
    <>
      <section aria-labelledby="proximos" className={styles.group}>
        <h2 id="proximos" className={styles.sectionTitle}>
          Próximos
        </h2>
        {upcoming.length === 0 && <p className={styles.muted}>No hay nada por jugar.</p>}
        {upcoming.map((m) =>
          m.open && m.status !== 'cancelled' ? (
            <CallCard key={m.id} seat={seat} match={m} focused={m.id === focused} />
          ) : (
            <Played key={m.id} match={m} />
          ),
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="jugados" className={styles.group}>
          <h2 id="jugados" className={styles.sectionTitle}>
            Ya jugados
          </h2>
          <ul className={styles.list}>
            {past.map((m) => (
              <li key={m.id}>
                <Played match={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Uno que ya no se responde: el marcador, "Cancelado" o nada (los entrenos). */
function Played({ match }: { match: Match }) {
  return (
    <div className={styles.played}>
      <span className={styles.playedText}>
        <span className={styles.playedTitle} id={`call-${match.id}`}>
          {matchTitle(match)}
        </span>
        <span className={styles.muted}>{matchWhen(match.startsAt)}</span>
      </span>
      {match.status === 'cancelled' ? (
        <Badge tone="danger">Cancelado</Badge>
      ) : match.result ? (
        <span className={styles.score}>
          <span aria-hidden="true">
            {match.result.goalsFor}–{match.result.goalsAgainst}
          </span>
          <span className="sr-only">
            {match.result.goalsFor} a {match.result.goalsAgainst}
          </span>
        </span>
      ) : null}
    </div>
  );
}
