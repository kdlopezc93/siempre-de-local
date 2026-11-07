import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { TeamColors } from './TeamColors';
import { TeamData } from './TeamData';
import styles from './TeamPage.module.css';
import { VisibilitySettings } from './VisibilitySettings';

/**
 * /equipos/:teamId/ajustes — los datos, los colores y lo que ven los jugadores (2026-11-06,
 * Kevin: la pantalla de Equipo quedaba muy larga). Los edita el entrenador o el admin del club;
 * los demás ven los datos y los colores.
 */
export function TeamSettingsPage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const clubAdmin = me.clubs.some((c) => c.id === membership?.club.id);
  const editable = (membership?.roles ?? []).includes('coach') || clubAdmin;
  return (
    <Screen className={styles.screen}>
      <Link to={`/equipos/${teamId}/equipo`} className={styles.back}>
        Equipo
      </Link>
      <PageTitle eyebrow={membership?.team.name} title="Datos y ajustes" />
      <TeamData teamId={teamId} editable={editable} />
      <TeamColors teamId={teamId} editable={editable} />
      {editable && <VisibilitySettings teamId={teamId} />}
    </Screen>
  );
}
