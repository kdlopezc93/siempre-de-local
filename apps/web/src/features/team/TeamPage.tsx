import type { Icon } from '@phosphor-icons/react';
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';

import type { Me } from '../../shared/api/auth';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { formatsLabel } from '../shell/shell-nav';
import { CardVisibility } from './CardVisibility';
import { TeamData } from './TeamData';
import styles from './TeamPage.module.css';

/**
 * /equipos/:teamId/equipo — el equipo (tu cuenta va aparte, en /cuenta). El PR 8 de la Fase 6 le suma los datos
 * del equipo y sus integrantes (07 §4.6).
 */
export function TeamPage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const clubAdmin = me.clubs.some((c) => c.id === membership?.club.id);
  const roles = membership?.roles ?? [];
  const coach = roles.includes('coach');
  const staff = coach || roles.includes('assistant');

  return (
    <Screen className={styles.screen}>
      {membership ? (
        <header>
          <h1 className={styles.title}>{membership.team.name}</h1>
          <p className={styles.muted}>
            {membership.club.name}, {formatsLabel(membership.team.formats, membership.team.format)}
          </p>
        </header>
      ) : (
        <h1 className={styles.title}>Equipo</h1>
      )}
      <TeamData teamId={teamId} editable={coach || clubAdmin} />
      <ul className={styles.list}>
        {(coach || clubAdmin) && (
          <Item to={`/equipos/${teamId}/invitar`} icon={UserPlus} title="Invitar jugadores" />
        )}
        {(staff || clubAdmin) && (
          <Item
            to={`/equipos/${teamId}/validacion`}
            icon={ChartLineUp}
            title="Informe de validación"
          />
        )}
        <Item to="/bases" icon={Question} title="En qué se basa el test" />
      </ul>
      {(coach || clubAdmin) && <CardVisibility teamId={teamId} />}
    </Screen>
  );
}

function Item({ to, icon: Glyph, title }: { to: string; icon: Icon; title: string }) {
  return (
    <li>
      <Row
        to={to}
        leading={
          <span className={styles.icon} aria-hidden="true">
            <Glyph size={22} />
          </span>
        }
        title={title}
      />
    </li>
  );
}
