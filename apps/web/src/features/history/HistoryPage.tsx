import { POSITIONS } from '@sdl/domain';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import styles from './HistoryPage.module.css';
import { useHistory, type HistoryEntry } from './use-history';
import { PageTitle } from '../../shared/ui/PageTitle';

const WHEN = new Intl.DateTimeFormat('es-419', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** /historial — mis tests de posición, también los que esperan señal para enviarse. */
export function HistoryPage({ me }: { me: Me }) {
  const history = useHistory(me.user.id);
  const teamName = (teamId: string) => me.teams.find((t) => t.team.id === teamId)?.team.name;
  const playerTeam = me.teams.find((t) => t.roles.includes('player'));

  return (
    <Screen className={styles.screen}>
      <PageTitle eyebrow="Tus" title="tests de posición" />

      {history.isPending && history.entries.length === 0 && (
        <p className="sr-only" role="status">
          Cargando tus tests…
        </p>
      )}
      {history.isError && (
        <p role="alert" className={styles.muted}>
          No pudimos cargar tu historial. Ábrelo una vez con conexión.
        </p>
      )}
      {!history.isPending && !history.isError && history.entries.length === 0 && (
        <div className={styles.empty}>
          <p>Todavía no has hecho el test de posición.</p>
          {playerTeam && (
            <ButtonLink to={`/equipos/${playerTeam.team.id}/test`}>Hacer mi test</ButtonLink>
          )}
        </div>
      )}

      {history.entries.length > 0 && (
        <ol className={styles.list}>
          {history.entries.map((entry) => (
            <li key={entry.kind === 'official' ? entry.result.attemptId : entry.submittedAt}>
              <Entry entry={entry} teamName={teamName} />
            </li>
          ))}
        </ol>
      )}
    </Screen>
  );
}

function Entry({
  entry,
  teamName,
}: {
  entry: HistoryEntry;
  teamName: (teamId: string) => string | undefined;
}) {
  const when = WHEN.format(new Date(entry.submittedAt));

  if (entry.kind === 'pending') {
    return (
      <div className={styles.entry}>
        <p className={styles.meta}>
          {when}
          {teamName(entry.teamId) && `, ${teamName(entry.teamId)}`}
        </p>
        <p className={styles.pending}>Pendiente: se envía cuando tengas señal y abras la app.</p>
      </div>
    );
  }

  const [first, ...rest] = entry.result.podium;
  return (
    <Link to={`/resultados/${entry.result.attemptId}`} className={styles.entryLink}>
      <p className={styles.meta}>
        {when}
        {teamName(entry.result.teamId) && `, ${teamName(entry.result.teamId)}`}
      </p>
      <p className={styles.first}>{POSITIONS[first!].name}</p>
      <p className={styles.rest}>{rest.map((pos) => POSITIONS[pos].name).join(' y ')}</p>
    </Link>
  );
}
