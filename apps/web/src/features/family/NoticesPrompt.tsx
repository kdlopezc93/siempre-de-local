import { Bell } from '@phosphor-icons/react/dist/csr/Bell';

import { usePush } from '../../shared/push/use-push';
import { Button } from '../../shared/ui/Button';
import styles from './Family.module.css';

/**
 * "Activa los avisos" (2026-11-10): sin ellos, el acudiente no se entera cuando convocan al niño.
 * Solo si este celular puede tenerlos y están apagados; en iPhone sin la app en el inicio, dice
 * cómo. Activados o imposibles, no sale.
 */
export function NoticesPrompt({ name }: { name: string }) {
  const { state, toggle } = usePush();
  if (state !== 'off' && state !== 'ios-install') return null;
  return (
    <section className={styles.notices} aria-labelledby="avisos-titulo">
      <span className={styles.noticesIcon} aria-hidden="true">
        <Bell size={22} />
      </span>
      <div className={styles.noticesText}>
        <h2 id="avisos-titulo" className={styles.noticesTitle}>
          Activa los avisos
        </h2>
        <p className={styles.muted}>
          {state === 'off'
            ? `Para enterarte en este celular cuando convoquen a ${name} y responder desde el aviso.`
            : 'En iPhone, primero agrega la app al inicio (Compartir → Agregar a inicio) y ábrela desde ahí.'}
        </p>
        {state === 'off' && (
          <Button variant="secondary" busy={toggle.isPending} onClick={() => toggle.mutate(true)}>
            {toggle.isPending ? 'Activando…' : 'Activar avisos'}
          </Button>
        )}
        {toggle.isError && (
          <p role="alert" className={styles.callError}>
            No pudimos activar los avisos. Revisa que el celular los permita e intenta de nuevo.
          </p>
        )}
      </div>
    </section>
  );
}
