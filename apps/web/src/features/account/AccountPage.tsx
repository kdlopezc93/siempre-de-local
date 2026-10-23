import type { TeamRole } from '@sdl/contracts';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { useState } from 'react';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { Token } from '../../shared/ui/Token';
import { useSignOut, useSignOutEverywhere } from '../auth/use-session';
import { rolesLabel } from '../shell/shell-nav';
import styles from './AccountPage.module.css';

const CLUB_ROLE = { owner: 'Dueño', admin: 'Administrador' } as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Lo que permite cada rol, en una línea. Es copia de la matriz del API
 * (`apps/api/src/shared/authz/policy.ts`), que es la que decide: si cambia, cambia esto.
 */
const CAN: Record<TeamRole, string> = {
  coach:
    'valora, puntúa la tarjeta, arma alineaciones, invita jugadores, anula exámenes y pide re-evaluaciones',
  assistant: 'valora, puntúa la tarjeta y arma alineaciones',
  player: 'hace el test y los exámenes; ve su tarjeta si el equipo lo permite',
};

/**
 * /cuenta — tú como persona, igual en todos tus equipos: tu perfil, tus equipos con tu rol
 * en cada uno (tus permisos) y cerrar sesión. Se llega desde tu ficha en el encabezado.
 */
export function AccountPage({ me }: { me: Me }) {
  const name = me.profile.displayName;
  return (
    <Screen className={styles.screen}>
      <header className={styles.hero}>
        <Token text={initialsOf(name)} size="lg" />
        <div className={styles.heroText}>
          <h1 className={styles.title}>{name}</h1>
          <p className={styles.muted} translate="no">
            {me.user.email}
          </p>
        </div>
      </header>

      <ul className={styles.list}>
        <li>
          <Row
            to="/perfil"
            leading={
              <span className={styles.icon} aria-hidden="true">
                <NotePencil size={22} />
              </span>
            }
            title="Editar mi perfil"
            meta="Cómo te dicen, tu pie, tus posiciones"
          />
        </li>
      </ul>

      <section aria-labelledby="equipos" className={styles.section}>
        <h2 id="equipos" className={styles.sectionTitle}>
          Tus equipos y lo que puedes hacer
        </h2>
        <ul className={styles.teams}>
          {me.teams.map(({ team, club, roles }) => (
            <li key={team.id} className={styles.team}>
              <Token text={initialsOf(team.name)} tone="amber" size="sm" />
              <div className={styles.teamText}>
                <p className={styles.teamName}>
                  {team.name} <span className={styles.muted}>({club.name})</span>
                </p>
                <p>{rolesLabel(roles)}</p>
                <p className={styles.muted}>
                  {roles.map((r, i) => (i === 0 ? cap(CAN[r]) : CAN[r])).join('. También ')}.
                </p>
              </div>
            </li>
          ))}
          {me.clubs.map((c) => (
            <li key={c.id} className={styles.team}>
              <Token text={initialsOf(c.name)} size="sm" />
              <div className={styles.teamText}>
                <p className={styles.teamName}>{c.name}</p>
                <p>{CLUB_ROLE[c.role]} del club</p>
                <p className={styles.muted}>
                  En sus equipos: ve los resultados, invita jugadores y cuerpo técnico, anula
                  exámenes, pide re-evaluaciones y cambia los ajustes.
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <SignOut />
    </Screen>
  );
}

function SignOut() {
  const signOut = useSignOut();
  const everywhere = useSignOutEverywhere();
  const [open, setOpen] = useState(false);
  const busy = signOut.isPending || everywhere.isPending;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cerrar sesión
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="¿Cerrar sesión?">
        <div className={styles.sheetActions}>
          {(signOut.isError || everywhere.isError) && (
            <p role="alert" className={styles.error}>
              No pudimos cerrar la sesión. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button busy={signOut.isPending} disabled={busy} onClick={() => signOut.mutate()}>
            En este celular
          </Button>
          <Button
            variant="ghost"
            busy={everywhere.isPending}
            disabled={busy}
            onClick={() => everywhere.mutate()}
          >
            En todos tus dispositivos
          </Button>
        </div>
      </Sheet>
    </>
  );
}
