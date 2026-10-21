import { Screen } from '../../shared/ui/Screen';
import { ConsentForm } from '../consent/ConsentForm';
import { useAcceptConsent } from '../consent/use-consent';
import { errorMessage } from '../join/use-join';
import styles from './Onboarding.module.css';

/** Ya está en un equipo pero no aceptó la política vigente (o cambió de versión). */
export function ConsentPage() {
  const accept = useAcceptConsent();
  return (
    <Screen className={styles.screen}>
      <div className={styles.body}>
        <h1 className={styles.title}>Antes de seguir</h1>
        <p className={styles.lead}>Esto es lo que guardamos de ti y para qué.</p>
        <ConsentForm
          submitLabel="Acepto"
          busy={accept.isPending}
          error={accept.isError ? errorMessage(accept.error) : null}
          onAccept={() => accept.mutate()}
        />
      </div>
    </Screen>
  );
}
