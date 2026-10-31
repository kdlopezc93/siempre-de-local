import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { Buildings } from '@phosphor-icons/react/dist/csr/Buildings';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';

import type { Me } from '../../shared/api/auth';
import { Badge } from '../../shared/ui/Badge';
import { useCharges } from '../charges/use-charges';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { formatsLabel } from '../shell/shell-nav';
import { VisibilitySettings } from './VisibilitySettings';
import { TeamData } from './TeamData';
import { TeamMembers } from './TeamMembers';
import styles from './TeamPage.module.css';
import { PageTitle } from '../../shared/ui/PageTitle';

/**
 * /equipos/:teamId/equipo — el equipo (tu cuenta va aparte, en /cuenta): sus datos, accesos,
 * integrantes y ajustes (07 §4.6).
 */
export function TeamPage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const clubAdmin = me.clubs.some((c) => c.id === membership?.club.id);
  const roles = membership?.roles ?? [];
  const coach = roles.includes('coach');
  const staff = coach || roles.includes('assistant');
  // Los cobros (`06` Cobros): cuerpo técnico, tesorero y admin del club.
  const money = staff || roles.includes('treasurer') || clubAdmin;
  const charges = useCharges(teamId, money);
  const reported = charges.data?.items.reduce((n, c) => n + (c.cancelled ? 0 : c.reported), 0) ?? 0;

  return (
    <Screen className={styles.screen}>
      {membership ? (
        <PageTitle
          eyebrow={membership.club.name}
          title={membership.team.name}
          subtitle={formatsLabel(membership.team.formats, membership.team.format)}
        />
      ) : (
        <h1 className={styles.title}>Equipo</h1>
      )}
      <TeamData teamId={teamId} editable={coach || clubAdmin} />
      <ul className={styles.list}>
        {(coach || clubAdmin) && (
          <Item to={`/equipos/${teamId}/invitar`} icon={UserPlus} title="Invitar al equipo" />
        )}
        {(coach || clubAdmin) && (
          <Item to={`/equipos/${teamId}/roles`} icon={UsersThree} title="Integrantes y roles" />
        )}
        {money && (
          <Item
            to={`/equipos/${teamId}/cobros`}
            icon={Wallet}
            title="Cobros"
            trailing={
              reported > 0 ? (
                <Badge tone="brand" size="sm">
                  {reported} por confirmar
                </Badge>
              ) : undefined
            }
          />
        )}
        {(staff || clubAdmin) && (
          <Item
            to={`/equipos/${teamId}/validacion`}
            icon={ChartLineUp}
            title="Informe de validación"
          />
        )}
        {clubAdmin && membership && (
          <Item
            to={`/clubes/${membership.club.id}`}
            icon={Buildings}
            title={`Club ${membership.club.name}`}
          />
        )}
        <Item to="/bases" icon={Question} title="En qué se basa el test" />
      </ul>
      <TeamMembers teamId={teamId} opensSheet={staff || clubAdmin} />
      {(coach || clubAdmin) && <VisibilitySettings teamId={teamId} />}
    </Screen>
  );
}

function Item({
  to,
  icon: Glyph,
  title,
  trailing,
}: {
  to: string;
  icon: Icon;
  title: string;
  /** Un pendiente a la derecha ("2 por confirmar"). */
  trailing?: ReactNode;
}) {
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
        trailing={trailing}
      />
    </li>
  );
}
