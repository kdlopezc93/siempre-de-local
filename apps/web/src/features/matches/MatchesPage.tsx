import type { Match } from '@sdl/contracts';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { Strategy } from '@phosphor-icons/react/dist/csr/Strategy';

import type { Me } from '../../shared/api/auth';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { LeadTask } from '../../shared/ui/TaskCard';
import { matchWhen, splitMatches } from './match-view';
import styles from './Matches.module.css';
import { useMatches } from './use-matches';

/** /equipos/:teamId/partidos — los próximos partidos, convocar y (adentro) las alineaciones. */
export function MatchesPage({ me, teamId }: { me: Me; teamId: string }) {
  const roles = me.teams.find((t) => t.team.id === teamId)?.roles ?? [];
  const staff = roles.includes('coach') || roles.includes('assistant');
  const player = roles.includes('player');
  const matches = useMatches(teamId);

  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>Partidos</h1>
      {staff && <LeadTask to={`/equipos/${teamId}/partidos/nuevo`} title="Convocar partido" />}
      {matches.isPending ? (
        <p className="sr-only" role="status">
          Cargando los partidos…
        </p>
      ) : matches.isError ? (
        <p role="alert" className={styles.muted}>
          No pudimos cargar los partidos. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : (
        <MatchList teamId={teamId} items={matches.data.items} staff={staff} player={player} />
      )}
      {staff && (
        <ul className={styles.list}>
          <li>
            <Row
              to={`/equipos/${teamId}/alineaciones`}
              leading={
                <span className={styles.icon} aria-hidden="true">
                  <Strategy size={22} />
                </span>
              }
              title="Alineaciones guardadas"
            />
          </li>
        </ul>
      )}
    </Screen>
  );
}

function MatchList({
  teamId,
  items,
  staff,
  player,
}: {
  teamId: string;
  items: Match[];
  staff: boolean;
  player: boolean;
}) {
  const { upcoming, past } = splitMatches(items);
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {staff
          ? 'Todavía no hay partidos. Convoca el próximo y el equipo responde si va.'
          : 'Todavía no hay partidos convocados.'}
      </p>
    );
  }
  return (
    <>
      <section aria-labelledby="proximos" className={styles.section}>
        <h2 id="proximos" className={styles.sectionTitle}>
          Próximos
        </h2>
        {upcoming.length === 0 ? (
          <p className={styles.muted}>No hay partidos por jugar.</p>
        ) : (
          <ul className={styles.list}>
            {upcoming.map((m) => (
              <li key={m.id}>
                <MatchRow teamId={teamId} match={m} staff={staff} player={player} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <details className={styles.past}>
          <summary>Anteriores ({past.length})</summary>
          <ul className={styles.list}>
            {past.map((m) => (
              <li key={m.id}>
                <MatchRow teamId={teamId} match={m} staff={staff} player={player} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function MatchRow({
  teamId,
  match,
  staff,
  player,
}: {
  teamId: string;
  match: Match;
  staff: boolean;
  player: boolean;
}) {
  return (
    <Row
      to={`/equipos/${teamId}/partidos/${match.id}`}
      leading={
        <span className={styles.icon} aria-hidden="true">
          <CalendarBlank size={22} />
        </span>
      }
      title={match.opponent}
      meta={`${matchWhen(match.startsAt)}, ${match.place}`}
      trailing={<RowStatus match={match} staff={staff} player={player} />}
    />
  );
}

function RowStatus({ match, staff, player }: { match: Match; staff: boolean; player: boolean }) {
  if (match.status === 'cancelled') return <span className={styles.cancelled}>Cancelado</span>;
  // Ya jugado (D18): el marcador; al cuerpo técnico, si falta cargarlo.
  if (match.result) {
    return (
      <span className={styles.score}>
        <span aria-hidden="true">
          {match.result.goalsFor}–{match.result.goalsAgainst}
        </span>
        <span className="sr-only">
          {match.result.goalsFor} a {match.result.goalsAgainst}
        </span>
      </span>
    );
  }
  if (staff && !match.open) return <span className={styles.ask}>Cargar resultado</span>;
  if (player && match.open && !match.myReply) return <span className={styles.ask}>Responder</span>;
  if (player && match.myReply) {
    return <span className={styles.reply}>{match.myReply === 'yes' ? 'Voy' : 'No voy'}</span>;
  }
  if (staff) return <span className={styles.muted}>{match.replies.yes} van</span>;
  return null;
}
