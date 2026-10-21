import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { CurrentUser } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useSignOut, useSignOutEverywhere } from '../auth/use-session';
import styles from './HomePage.module.css';

/** Pantalla provisional de Fase 0: confirma que la sesión funciona. */
export function HomePage({ user }: { user: CurrentUser }) {
  const signOut = useSignOut();
  const signOutEverywhere = useSignOutEverywhere();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);

  const busy = signOut.isPending || signOutEverywhere.isPending;
  const failed = signOut.isError || signOutEverywhere.isError;
  const firstName = user.name.split(' ')[0] || user.name;

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

        {/* TEMPORAL · spike PWA (docs/spikes/pwa.md) */}
        <Link to="/prueba-pwa" className={styles.spikeLink}>
          Probar la app sin conexión
        </Link>

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
