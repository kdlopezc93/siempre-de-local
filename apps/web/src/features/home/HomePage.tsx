import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { Strategy } from '@phosphor-icons/react/dist/csr/Strategy';

import type { Me } from '../../shared/api/auth';
import { Screen } from '../../shared/ui/Screen';
import { LeadTask, TaskRow } from '../../shared/ui/TaskCard';
import { useHistory } from '../history/use-history';
import { useActiveTeam } from '../shell/use-active-team';
import styles from './HomePage.module.css';

/**
 * "/" — por ahora, el saludo y los atajos del equipo activo. El PR 4 de la Fase 6 lo
 * convierte en "lo que toca" (07 §4.3).
 */
export function HomePage({ me }: { me: Me }) {
  const { active } = useActiveTeam(me);
  const history = useHistory(me.user.id);
  // Como le dicen en la cancha (perfil); por defecto, su nombre de Google.
  const displayName = me.profile.displayName;
  const firstName = displayName.split(' ')[0] || displayName;
  const roles = active?.roles ?? [];
  const player = roles.includes('player');
  const staff = roles.includes('coach') || roles.includes('assistant');
  const teamId = active?.team.id;

  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>Hola, {firstName}</h1>
      {teamId && player && !history.isPending && history.entries.length === 0 && (
        <LeadTask
          to={`/equipos/${teamId}/test`}
          title="Haz tu test de posición"
          detail="20 preguntas sobre situaciones de juego"
        />
      )}
      {teamId && (staff || player) && (
        <div className={styles.tasks}>
          {staff && (
            <TaskRow
              to={`/equipos/${teamId}/planificador`}
              icon={Strategy}
              title="Armar la alineación"
            />
          )}
          {player && (
            <TaskRow
              to={`/equipos/${teamId}/tarjeta`}
              icon={IdentificationCard}
              title="Mi tarjeta"
            />
          )}
        </div>
      )}
      {!teamId && (
        <p className={styles.muted}>
          Todavía no tienes un rol en ningún equipo. Cuando te inviten, aparece aquí.
        </p>
      )}
    </Screen>
  );
}
