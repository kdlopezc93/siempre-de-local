import { House } from '@phosphor-icons/react/dist/csr/House';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Suspense, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { BottomNav } from '../../shared/ui/BottomNav';
import { TeamHeader, type HeaderTeam } from '../../shared/ui/TeamHeader';
import styles from './AppShell.module.css';
import {
  activeTab,
  formatsLabel,
  rolesLabel,
  switchTarget,
  tabsFor,
  type TabId,
} from './shell-nav';
import { useActiveTeam } from './use-active-team';
import { useNavBadges } from './use-nav-badges';

const ICONS = {
  inicio: House,
  plantilla: UsersThree,
  partidos: CalendarCheck,
  'mi-juego': IdentificationCard,
  equipo: ShieldCheck,
} satisfies Record<TabId, unknown>;

const toHeader = ({ team, club, roles }: Me['teams'][number]): HeaderTeam => ({
  id: team.id,
  name: team.name,
  club: club.name,
  format: formatsLabel(team.formats, team.format),
  roles: rolesLabel(roles),
});

/**
 * El armazón de las pantallas de la app (07 §4): arriba el equipo activo (con selector si
 * hay más de uno), abajo las pestañas de tu rol en él. Las pantallas de tarea (test,
 * examen, valorar, puntuar) van sin armazón, a pantalla completa.
 */
export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const { active, choose } = useActiveTeam(me);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const badges = useNavBadges(active?.team.id ?? '', active?.roles ?? []);
  // Admin de club sin rol en ningún equipo: todavía no hay equipo que mostrar.
  if (!active) return <>{children}</>;

  const tabs = tabsFor(active.team.id, active.roles);
  const current = activeTab(pathname, tabs);

  return (
    <div className={styles.shell} data-shell="">
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <TeamHeader
        team={toHeader(active)}
        account={{ name: me.profile.displayName, to: '/cuenta' }}
        teams={me.teams.map(toHeader)}
        onSwitch={(teamId) => {
          choose(teamId);
          const target = me.teams.find((t) => t.team.id === teamId)!;
          void navigate(switchTarget(current?.id, tabsFor(teamId, target.roles)));
        }}
      />
      <Suspense
        fallback={
          <p className="sr-only" role="status">
            Cargando…
          </p>
        }
      >
        {children}
      </Suspense>
      <BottomNav
        items={tabs.map((t) => ({
          to: t.to,
          label: t.label,
          icon: ICONS[t.id],
          ...(badges[t.id] ? { badge: badges[t.id] } : {}),
        }))}
        current={current?.to}
      />
    </div>
  );
}
