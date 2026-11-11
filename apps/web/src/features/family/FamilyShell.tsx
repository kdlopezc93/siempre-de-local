import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { Suspense, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { BottomNav } from '../../shared/ui/BottomNav';
import { TeamHeader, type HeaderKid } from '../../shared/ui/TeamHeader';
import styles from '../shell/AppShell.module.css';
import { toHeader } from '../shell/shell-nav';
import { useActiveTeam } from '../shell/use-active-team';
import { kidPath, kidTabOf, kidTabs, writeLastKid } from './family-nav';
import { useKidsPending } from './use-family';

const ICONS = { inicio: House, partidos: CalendarCheck, cuentas: Wallet } as const;

/**
 * El armazón de la app del acudiente (2026-11-10): arriba el niño que estás viendo (con el
 * selector de tus hijos y tus equipos), abajo Inicio, Partidos y Cuentas de ese niño.
 */
export function FamilyShell({
  me,
  seat,
  seats,
  children,
}: {
  me: Me;
  seat: HeaderKid;
  seats: readonly HeaderKid[];
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { choose } = useActiveTeam(me);
  const tab = kidTabOf(pathname);
  const pending = useKidsPending(seats);
  const kids = seats.map((k) => ({ ...k, pending: pending.has(`${k.id}:${k.teamId}`) }));
  const tabs = kidTabs(seat);

  // Primitivas: el puesto se arma de nuevo en cada render.
  const { id, teamId } = seat;
  useEffect(() => writeLastKid({ id, teamId }), [id, teamId]);

  return (
    <div className={styles.shell} data-shell="">
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <TeamHeader
        kid={seat}
        kids={kids}
        teams={me.teams.map(toHeader)}
        account={{ name: me.profile.displayName, to: '/cuenta' }}
        onPickKid={(k) => void navigate(kidPath(k, tab))}
        onSwitch={(teamId) => {
          writeLastKid(null);
          choose(teamId);
          void navigate('/');
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
        items={tabs.map((t) => ({ to: t.to, label: t.label, icon: ICONS[t.id] }))}
        current={tabs.find((t) => t.id === tab)?.to}
      />
    </div>
  );
}
