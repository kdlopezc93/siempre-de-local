import type { Injury } from '@sdl/contracts';
import { useId, useState, type FormEvent } from 'react';

import { injuryText, todayIso } from './injury';
import styles from './PlayerProfilePage.module.css';
import { useSetInjury } from './use-squad';

/**
 * Lesionado (2026-10-24): lo marca el cuerpo técnico, con una vuelta estimada opcional. No se
 * anota qué tiene. Mientras esté marcado, el planificador no lo convoca solo.
 */
export function InjuryControl({
  teamId,
  playerId,
  injury,
}: {
  teamId: string;
  playerId: string;
  injury: Injury | null;
}) {
  const set = useSetInjury(teamId, playerId);
  const [editing, setEditing] = useState(false);
  const [returnOn, setReturnOn] = useState(injury?.returnOn ?? '');
  const dateId = useId();
  const hintId = useId();
  const today = todayIso();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set.mutate({ returnOn: returnOn || null }, { onSuccess: () => setEditing(false) });
  }

  const failure = set.isError && (
    <p role="alert" className={styles.error}>
      No pudimos guardarlo. Revisa tu conexión e intenta de nuevo.
    </p>
  );

  if (editing) {
    return (
      <form className={styles.jerseyForm} onSubmit={save} noValidate>
        <label htmlFor={dateId} className={styles.label}>
          ¿Cuándo vuelve más o menos?
        </label>
        <div className={styles.injuryRow}>
          <input
            id={dateId}
            name="returnOn"
            type="date"
            min={today}
            className={styles.dateInput}
            value={returnOn}
            aria-describedby={hintId}
            onChange={(event) => setReturnOn(event.target.value)}
          />
          <button type="submit" className={styles.primaryLink} disabled={set.isPending}>
            {set.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className={styles.secondaryLink}
            onClick={() => setEditing(false)}
            disabled={set.isPending}
          >
            Cancelar
          </button>
        </div>
        <p id={hintId} className={styles.muted}>
          Opcional. Ese día te recordamos confirmar si ya volvió.
        </p>
        {failure}
      </form>
    );
  }

  if (!injury) {
    return (
      <>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setReturnOn('');
            setEditing(true);
          }}
        >
          Marcar lesionado
        </button>
        {failure}
      </>
    );
  }
  return (
    <div className={styles.injury}>
      <p className={styles.injuryText}>{injuryText(injury, today)}</p>
      <div className={styles.injuryActions}>
        <button
          type="button"
          className={styles.secondaryLink}
          disabled={set.isPending}
          onClick={() => set.mutate(null)}
        >
          {set.isPending ? 'Guardando…' : 'Ya volvió'}
        </button>
        <button
          type="button"
          className={styles.secondaryLink}
          disabled={set.isPending}
          onClick={() => {
            setReturnOn(injury.returnOn ?? '');
            setEditing(true);
          }}
        >
          Cambiar la fecha
        </button>
      </div>
      {failure}
    </div>
  );
}
