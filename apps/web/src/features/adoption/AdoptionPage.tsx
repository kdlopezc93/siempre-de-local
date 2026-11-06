import { Link } from 'react-router';

import { appUrl } from '../../shared/share';
import { Button } from '../../shared/ui/Button';
import { GroupShare } from '../../shared/ui/GroupShare';
import { Screen } from '../../shared/ui/Screen';
import { VacaStrip } from '../charges/ChargesPage';
import { useRemindTest } from '../squad/use-squad';
import { adoptionGroups, adoptionSummary, noticesMessage } from './adoption-view';
import styles from './Adoption.module.css';
import { useAdoption } from './use-adoption';

type Tone = 'wait' | 'no' | 'hurt';

/**
 * /equipos/:teamId/la-app — la app en el equipo (2026-11-06, Kevin): cuántos entraron esta
 * semana, con avisos, con test y respondieron la última convocatoria, y a quién recordarle. Solo
 * rangos, nunca la hora ni qué hizo cada uno (política de datos §4).
 */
export function AdoptionPage({ teamId }: { teamId: string }) {
  const data = useAdoption(teamId);
  const remind = useRemindTest(teamId);
  const back = (
    <Link to={`/equipos/${teamId}/equipo`} className={styles.back}>
      Equipo
    </Link>
  );
  if (data.isPending) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }
  if (data.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert" className={styles.error}>
          No pudimos cargar cómo va la app en el equipo. Revisa tu conexión e intenta de nuevo.
        </p>
      </Screen>
    );
  }
  const { players } = data.data;
  const sum = adoptionSummary(players);
  const groups = adoptionGroups(players);
  const marks = players
    .map((p) => (p.seen === 'week' ? ('paid' as const) : ('pending' as const)))
    .sort();
  const group = (title: string, tone: Tone, people: typeof players) =>
    people.length > 0 && (
      <section
        aria-label={`${title} (${people.length})`}
        className={[styles.group, styles[tone]].join(' ')}
      >
        <h2 className={styles.groupTitle}>
          {title} ({people.length})
        </h2>
        <ul className={styles.pills}>
          {people.map((p) => (
            <li key={p.userId}>
              <span className={styles.dorsal} aria-hidden="true">
                {p.jerseyNumber ?? p.displayName.slice(0, 2).toUpperCase()}
              </span>
              {p.displayName}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <Screen className={styles.screen}>
      {back}
      <h1 className={styles.title}>La app en el equipo</h1>
      <section aria-label="Quién usa la app" className={styles.lead}>
        <span className={styles.leadLabel}>Entraron a la app esta semana</span>
        <span className={styles.leadAmount}>
          {sum.week} <span className={styles.leadOf}>de {sum.total}</span>
        </span>
        {sum.total > 0 && (
          <VacaStrip marks={marks} label={`${sum.week} de ${sum.total} entraron esta semana`} />
        )}
      </section>

      <dl className={styles.stats}>
        <div>
          <dt>Con avisos</dt>
          <dd>
            {sum.notices}
            <span>/{sum.total}</span>
          </dd>
        </div>
        <div>
          <dt>Hicieron el test</dt>
          <dd>
            {sum.tests}
            <span>/{sum.total}</span>
          </dd>
        </div>
        <div>
          <dt>Respondieron la última</dt>
          <dd>
            {data.data.lastCallUp ? (
              <>
                {sum.replied}
                <span>/{sum.answerable}</span>
              </>
            ) : (
              '–'
            )}
          </dd>
        </div>
      </dl>

      {group('Sin avisos', 'wait', groups.noNotices)}
      {groups.noNotices.length > 0 && (
        <GroupShare
          label="Pedirles los avisos en el grupo"
          message={noticesMessage(
            groups.noNotices.map((p) => p.displayName),
            appUrl('/cuenta'),
          )}
        />
      )}
      {group('No entran hace más de una semana', 'no', groups.away)}
      {group('Sin test', 'hurt', groups.noTest)}
      {groups.noTest.length > 0 && (
        <Button variant="secondary" busy={remind.isPending} onClick={() => remind.mutate()}>
          {remind.isSuccess ? 'Listo, se lo recordamos' : 'Recordarles el test'}
        </Button>
      )}
      {remind.isError && (
        <p role="alert" className={styles.error}>
          No pudimos mandar el recordatorio. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <p className={styles.note}>
        Nunca se ve qué hizo cada uno en la app: solo si entró esta semana o antes.
      </p>
    </Screen>
  );
}
