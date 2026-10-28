import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { POLICY_VERSION } from '@sdl/contracts';
import { lazy, Suspense, useId, useRef, useState, type FormEvent } from 'react';

import { Button } from '../../shared/ui/Button';
import styles from './ConsentForm.module.css';

// El texto completo solo se descarga si la persona lo despliega.
const PolicyText = lazy(() => import('./PolicyText').then((m) => ({ default: m.PolicyText })));

interface ConsentFormProps {
  /** Texto del botón: dice exactamente lo que pasa al tocarlo. */
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
}

/**
 * Resumen de la política en lenguaje claro, texto completo desplegable y declaración de
 * mayoría de edad (04 §1.2). La autorización es expresa: casilla + botón.
 */
export function ConsentForm({ submitLabel, busy, error, onAccept }: ConsentFormProps) {
  const [adult, setAdult] = useState(false);
  const [missingAge, setMissingAge] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const ageRef = useRef<HTMLInputElement>(null);
  const ageHintId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adult) {
      setMissingAge(true);
      ageRef.current?.focus();
      return;
    }
    onAccept();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <ul className={styles.summary}>
        <li>
          <span className={styles.icon}>
            <IdentificationCard size={20} aria-hidden="true" />
          </span>
          Guardamos tu nombre, tu correo y lo que respondes en la app. Nada de documentos, dirección
          ni teléfono.
        </li>
        <li>
          <span className={styles.icon}>
            <Eye size={20} aria-hidden="true" />
          </span>
          Lo ven tú y el cuerpo técnico de tu equipo. Nadie de fuera.
        </li>
        <li>
          <span className={styles.icon}>
            <DownloadSimple size={20} aria-hidden="true" />
          </span>
          Puedes descargar tus datos o pedir que los borremos cuando quieras.
        </li>
      </ul>

      <details
        className={styles.details}
        onToggle={(event) => setPolicyOpen(event.currentTarget.open)}
      >
        <summary>Leer la política completa</summary>
        {policyOpen && (
          <Suspense fallback={<p role="status">Cargando la política…</p>}>
            <PolicyText />
          </Suspense>
        )}
      </details>

      <div className={styles.age}>
        <label className={styles.check}>
          <input
            ref={ageRef}
            type="checkbox"
            name="age"
            checked={adult}
            aria-invalid={missingAge && !adult}
            aria-describedby={missingAge && !adult ? ageHintId : undefined}
            onChange={(event) => {
              setAdult(event.target.checked);
              setMissingAge(false);
            }}
          />
          <span>Tengo 18 años o más</span>
        </label>
        {missingAge && !adult && (
          <p id={ageHintId} className={styles.fieldError}>
            Por ahora la app es solo para mayores de edad. Marca la casilla si es tu caso.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      <Button type="submit" busy={busy}>
        {busy ? 'Guardando…' : submitLabel}
      </Button>
      {POLICY_VERSION.includes('borrador') && (
        <p className={styles.note}>Esta es una versión de prueba de la política.</p>
      )}
    </form>
  );
}
