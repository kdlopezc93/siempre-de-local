import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useSignOut, useSignOutEverywhere } from '../auth/use-session';
import styles from './HomePage.module.css';

/** Pantalla provisional de Fase 0: confirma que la sesión funciona. */
export function HomePage({ me }: { me: Me }) {
  const { user } = me;
  const signOut = useSignOut();
  const signOutEverywhere = useSignOutEverywhere();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);

  const busy = signOut.isPending || signOutEverywhere.isPending;
  const failed = signOut.isError || signOutEverywhere.isError;
  // Como le dicen en la cancha (perfil); por defecto, su nombre de Google.
  const displayName = me.profile.displayName;
  const firstName = displayName.split(' ')[0] || displayName;

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  return (
    <Screen>
      <div className={styles.content}>
        <h1 className={styles.title}>Hola, {firstName}</h1>
        <p className={styles.lead}>
          Ya entraste como{' '}
          <span className={styles.email} translate="no">
            {user.email}
          </span>
          . Muy pronto vas a poder hacer tu test de posición desde aquí.
        </p>

        {me.teams.length > 0 && (
          <ul className={styles.teams} aria-label="Tus equipos">
            {me.teams.map(({ team, club, roles }) => (
              <li key={team.id} className={styles.team}>
                <p className={styles.teamName}>{team.name}</p>
                <p className={styles.teamClub}>{club.name}</p>
                {roles.includes('player') && (
                  <Link to={`/equipos/${team.id}/test`} className={styles.teamAction}>
                    Hacer mi test de posición
                  </Link>
                )}
                {roles.includes('player') && (
                  <Link to={`/equipos/${team.id}/tarjeta`} className={styles.teamAction}>
                    Ver mi tarjeta
                  </Link>
                )}
                {(roles.includes('coach') || roles.includes('assistant')) && (
                  <Link to={`/equipos/${team.id}/plantilla`} className={styles.teamAction}>
                    Ver la plantilla
                  </Link>
                )}
                {roles.includes('coach') && (
                  <Link to={`/equipos/${team.id}/invitar`} className={styles.teamAction}>
                    Invitar jugadores
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <nav aria-label="Más" className={styles.more}>
          <Link to="/perfil" className={styles.teamAction}>
            Tu perfil
          </Link>
          <Link to="/historial" className={styles.teamAction}>
            Tus tests
          </Link>
          {me.teams.some((t) => t.roles.includes('player')) && (
            <Link to="/conocimiento" className={styles.teamAction}>
              Examen de conocimiento
            </Link>
          )}
          <Link to="/bases" className={styles.teamAction}>
            En qué se basa el test
          </Link>
        </nav>

        <div className={styles.actions}>
          {failed && (
            <p role="alert" className={styles.alert}>
              No pudimos cerrar la sesión. Revisa tu conexión e intenta de nuevo.
            </p>
          )}

          {confirming ? (
            <div className={styles.confirm}>
              <p ref={confirmRef} tabIndex={-1} className={styles.confirmText}>
                Vas a salir en este celular y en cualquier otro donde hayas entrado.
              </p>
              <Button
                variant="secondary"
                busy={signOutEverywhere.isPending}
                disabled={busy}
                onClick={() => signOutEverywhere.mutate()}
              >
                Sí, cerrar en todos
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="secondary"
                busy={signOut.isPending}
                disabled={busy}
                onClick={() => signOut.mutate()}
              >
                Cerrar sesión
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
                Cerrar sesión en todos tus dispositivos
              </Button>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
