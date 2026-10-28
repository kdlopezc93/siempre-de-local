import type { Icon } from '@phosphor-icons/react';
import { Brain } from '@phosphor-icons/react/dist/csr/Brain';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { FirstAid } from '@phosphor-icons/react/dist/csr/FirstAid';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { SoccerBall } from '@phosphor-icons/react/dist/csr/SoccerBall';
import { Strategy } from '@phosphor-icons/react/dist/csr/Strategy';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';

import type { Me } from '../../shared/api/auth';
import { Screen } from '../../shared/ui/Screen';
import { LeadTask, TaskRow } from '../../shared/ui/TaskCard';
import { useActiveTeam } from '../shell/use-active-team';
import { myInjuryText, todayIso } from '../squad/injury';
import styles from './HomePage.module.css';
import type { Todo, TodoIcon } from './todo';
import { arrange } from './todo';
import { useHomeTodos } from './use-home';
import { PageTitle } from '../../shared/ui/PageTitle';
import { SectionHead } from '../../shared/ui/SectionHead';

/** El color del mosaico de cada tarea: lo del partido en volt, lo de valorar en sol… */
const TINTS: Record<TodoIcon, 1 | 2 | 3 | 4 | 5 | 6> = {
  exam: 4,
  test: 1,
  assess: 2,
  card: 5,
  review: 3,
  lineup: 6,
  match: 1,
  injury: 3,
};

const TODAY = new Intl.DateTimeFormat('es-419', { weekday: 'long', day: 'numeric', month: 'long' });
const today = () => {
  const text = TODAY.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const ICONS: Record<TodoIcon, Icon> = {
  exam: Brain,
  test: SoccerBall,
  assess: ClipboardText,
  card: IdentificationCard,
  review: Warning,
  lineup: Strategy,
  match: CalendarCheck,
  injury: FirstAid,
};

/**
 * "/" — lo que toca en el equipo activo (07 §4.3): lo más urgente como bloque cobalto y lo
 * demás en filas cortas; si tienes los dos roles, separadas por rol.
 */
export function HomePage({ me }: { me: Me }) {
  const { active } = useActiveTeam(me);
  const roles = active?.roles ?? [];
  const home = useHomeTodos(me, active?.team.id, roles);
  // Como le dicen en la cancha (perfil); por defecto, su nombre de Google.
  const displayName = me.profile.displayName;
  const firstName = displayName.split(' ')[0] || displayName;
  const { lead, rest } = arrange(home.todos);
  const both = home.staff && home.player;
  const staffRows = rest.filter((t) => t.who === 'staff');
  if (home.shortcut) staffRows.push(home.shortcut);
  const playerRows = rest.filter((t) => t.who === 'player');

  return (
    <Screen className={styles.screen}>
      <PageTitle eyebrow={`Hola, ${firstName}`} title="Tu equipo" subtitle={today()} />
      {active?.injury && (
        <p className={styles.injury}>
          <FirstAid size={20} weight="fill" aria-hidden="true" />
          {myInjuryText(active.injury, todayIso())}
        </p>
      )}
      {!active ? (
        <p className={styles.muted}>
          Todavía no tienes un rol en ningún equipo. Cuando te inviten, aparece aquí.
        </p>
      ) : home.isPending ? (
        <p className="sr-only" role="status">
          Cargando lo que te toca…
        </p>
      ) : (
        <>
          {lead ? (
            <LeadTask
              to={lead.to}
              title={lead.title}
              {...(lead.detail ? { detail: lead.detail } : {})}
            />
          ) : (
            <p className={styles.done}>
              <CheckCircle size={24} weight="fill" aria-hidden="true" />
              Estás al día.
            </p>
          )}
          <Group title={both ? 'Del cuerpo técnico' : null} todos={staffRows} />
          <Group title={both ? 'Como jugador' : null} todos={playerRows} />
          {home.isError && (
            <p role="alert" className={styles.muted}>
              No pudimos cargar todo lo que te toca. Revisa tu conexión.
            </p>
          )}
        </>
      )}
    </Screen>
  );
}

function Group({ title, todos }: { title: string | null; todos: Todo[] }) {
  if (todos.length === 0) return null;
  const rows = todos.map((t) => (
    <TaskRow
      key={t.id}
      to={t.to}
      icon={ICONS[t.icon]}
      title={t.short ?? t.title}
      tint={TINTS[t.icon]}
      {...(t.count !== undefined ? { count: t.count } : {})}
    />
  ));
  if (!title) return <div className={styles.group}>{rows}</div>;
  const id = `grupo-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={styles.group}>
      <SectionHead id={id} title={title} />
      {rows}
    </section>
  );
}
