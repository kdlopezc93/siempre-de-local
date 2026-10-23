import type { DominantFoot, Profile } from '@sdl/contracts';
import { POSITION_CODES, POSITIONS } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Pitch } from '../../shared/ui/Pitch';
import { PhotoPicker } from '../../shared/ui/PhotoPicker';
import { Screen } from '../../shared/ui/Screen';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useMyPhoto } from '../photos/use-photos';
import styles from './ProfilePage.module.css';
import { togglePreference, useSaveProfile } from './use-profile';

const FEET: { value: DominantFoot; label: string }[] = [
  { value: 'right', label: 'Derecho' },
  { value: 'left', label: 'Izquierdo' },
  { value: 'both', label: 'Los dos' },
];

/** /perfil — lo que el jugador dice de sí mismo; distinto del test y de la valoración. */
export function ProfilePage({ me }: { me: Me }) {
  const [draft, setDraft] = useState<Profile>(me.profile);
  const save = useSaveProfile(me.profile);
  const nameId = useId();
  const nameHintId = useId();
  const nameInvalid = draft.displayName.trim().length < 2;
  const [showNameError, setShowNameError] = useState(false);

  function change(next: Partial<Profile>) {
    setDraft((d) => ({ ...d, ...next }));
    save.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameInvalid) {
      setShowNameError(true);
      document.getElementById(nameId)?.focus();
      return;
    }
    save.mutate({ ...draft, displayName: draft.displayName.trim() });
  }

  const error =
    save.error instanceof ApiError && save.error.status < 500
      ? save.error.message
      : save.isError
        ? 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'
        : null;

  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>Tu perfil</h1>
      <MyPhoto me={me} />
      <p className={styles.lead}>
        Esto es lo que tú dices de ti. Tu entrenador lo ve junto con tu test y su propia mirada.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={nameId} className={styles.label}>
            Cómo te dicen en la cancha
          </label>
          <input
            id={nameId}
            name="nickname"
            className={styles.input}
            value={draft.displayName}
            maxLength={40}
            autoComplete="nickname"
            spellCheck={false}
            aria-invalid={showNameError && nameInvalid}
            aria-describedby={showNameError && nameInvalid ? nameHintId : undefined}
            onChange={(event) => change({ displayName: event.target.value })}
          />
          {showNameError && nameInvalid && (
            <p id={nameHintId} className={styles.fieldError}>
              Escribe al menos 2 letras.
            </p>
          )}
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Pie dominante</legend>
          <div className={styles.segmented}>
            {FEET.map((foot) => (
              <label key={foot.value} className={styles.segment}>
                <input
                  type="radio"
                  name="foot"
                  value={foot.value}
                  checked={draft.dominantFoot === foot.value}
                  onChange={() => change({ dominantFoot: foot.value })}
                />
                <span>{foot.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.check}>
          <input
            type="checkbox"
            name="goalkeeper"
            checked={draft.playsGoalkeeper}
            onChange={(event) => change({ playsGoalkeeper: event.target.checked })}
          />
          <span>Juego o podría jugar de portero</span>
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Dónde te gusta jugar</legend>
          <p className={styles.hint}>Toca hasta 3 en orden: la primera es la que más te gusta.</p>
          <div className={styles.positions}>
            {POSITION_CODES.map((pos) => {
              const rank = draft.preferredPositions.indexOf(pos);
              const full = draft.preferredPositions.length === 3 && rank < 0;
              return (
                <button
                  key={pos}
                  type="button"
                  className={styles.position}
                  aria-pressed={rank >= 0}
                  disabled={full}
                  onClick={() =>
                    change({ preferredPositions: togglePreference(draft.preferredPositions, pos) })
                  }
                >
                  <span className={styles.badge} aria-hidden="true">
                    {rank >= 0 ? rank + 1 : POSITIONS[pos].number}
                  </span>
                  <span>{POSITIONS[pos].name}</span>
                  {rank >= 0 && <span className="sr-only">, preferida número {rank + 1}</span>}
                </button>
              );
            })}
          </div>
          <div className={styles.board}>
            <Pitch
              format="F11"
              marked={draft.preferredPositions}
              label={
                draft.preferredPositions.length
                  ? `Cancha con tus preferidas: ${draft.preferredPositions.map((p) => POSITIONS[p].name).join(', ')}`
                  : 'Cancha sin posiciones elegidas'
              }
            />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
        <p className={styles.saved} aria-live="polite">
          {save.isSuccess ? 'Guardado.' : ''}
        </p>
        <Button type="submit" busy={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Screen>
  );
}

/** Tu foto: opcional, la ve solo tu equipo (07 §4.7). */
function MyPhoto({ me }: { me: Me }) {
  const photo = useMyPhoto();
  return (
    <section aria-labelledby="tu-foto" className={styles.section}>
      <h2 id="tu-foto" className={styles.sectionTitle}>
        Tu foto
      </h2>
      <PhotoPicker
        label="Elegir tu foto"
        current={me.profile.photoUrl}
        fallback={initialsOf(me.profile.displayName)}
        busy={photo.upload.isPending || photo.remove.isPending}
        error={photo.error}
        onUpload={(blob, done) => photo.upload.mutate(blob, { onSuccess: done })}
        onRemove={() => photo.remove.mutate()}
      />
      <p className={styles.hint}>
        Opcional. La ve solo tu equipo y la puedes quitar cuando quieras.
      </p>
    </section>
  );
}
