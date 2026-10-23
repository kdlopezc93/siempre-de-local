import type { PositionCode } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, POSITIONS } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { useTeam } from '../team-admin/use-invitations';
import { useBackTo } from './back';
import styles from './AssessPage.module.css';
import { useCreateAssessment, useSquad } from './use-squad';

const CONFIDENCE = [
  { value: 1, label: 'Muy poca' },
  { value: 2, label: 'Poca' },
  { value: 3, label: 'Media' },
  { value: 4, label: 'Bastante' },
  { value: 5, label: 'Total' },
];

/** /equipos/:teamId/plantilla/:playerId/valorar — dónde ves tú a este jugador. */
export function AssessPage({ teamId, playerId }: { teamId: string; playerId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const create = useCreateAssessment(teamId);
  const navigate = useNavigate();
  const back = useBackTo(`/equipos/${teamId}/plantilla`);
  const [primary, setPrimary] = useState<PositionCode | null>(null);
  const [secondary, setSecondary] = useState<PositionCode[]>([]);
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [missingPrimary, setMissingPrimary] = useState(false);
  const guard = useUnsavedChanges(
    primary !== null || secondary.length > 0 || confidence !== 3 || notes.trim() !== '',
  );
  const primaryHint = useId();
  const notesId = useId();

  const player = squad.data?.players.find((p) => p.userId === playerId);
  if (team.isPending || squad.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }
  if (!player || !team.data) {
    return (
      <Screen className={styles.screen}>
        <BackLink to={back} />
        <p role="alert">Ese jugador no está en la plantilla.</p>
      </Screen>
    );
  }

  // En F8 solo se ofrecen las 6 posiciones del formato.
  const positions = ELIGIBLE_POSITIONS[team.data.team.format];

  function choosePrimary(pos: PositionCode) {
    setPrimary(pos);
    setSecondary((s) => s.filter((p) => p !== pos));
    setMissingPrimary(false);
  }

  function toggleSecondary(pos: PositionCode) {
    setSecondary((s) =>
      s.includes(pos) ? s.filter((p) => p !== pos) : s.length < 2 ? [...s, pos] : s,
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!primary) {
      setMissingPrimary(true);
      document.getElementById(`primary-${positions[0]}`)?.focus();
      return;
    }
    create.mutate(
      {
        playerId,
        primaryPosition: primary,
        secondaryPositions: secondary,
        confidence,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          guard.release();
          void navigate(back);
        },
      },
    );
  }

  const error =
    create.error instanceof ApiError && create.error.status < 500
      ? create.error.message
      : create.isError
        ? 'No pudimos guardar la valoración. Revisa tu conexión e intenta de nuevo.'
        : null;

  return (
    <Screen className={styles.screen}>
      {guard.prompt}
      <BackLink to={back} />
      <header>
        <h1 className={styles.title}>Valorar a {player.displayName}</h1>
        <p className={styles.lead}>
          {player.assessedByMe
            ? 'Tu mirada de hoy. Las anteriores quedan en su historial.'
            : player.test.status === 'hidden'
              ? 'Es tu primera valoración: va a ciegas. Al guardarla vas a ver su test.'
              : 'Es tu primera valoración de este jugador.'}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset
          className={styles.fieldset}
          aria-describedby={missingPrimary ? primaryHint : undefined}
        >
          <legend className={styles.label}>Dónde lo ves</legend>
          <div className={styles.positions}>
            {positions.map((pos) => (
              <label key={pos} className={styles.choice}>
                <input
                  id={`primary-${pos}`}
                  type="radio"
                  name="primary"
                  checked={primary === pos}
                  onChange={() => choosePrimary(pos)}
                />
                <span className={styles.number}>{POSITIONS[pos].number}</span>
                <span>{POSITIONS[pos].name}</span>
              </label>
            ))}
          </div>
          {missingPrimary && (
            <p id={primaryHint} className={styles.fieldError}>
              Elige la posición donde más lo ves.
            </p>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>También podría jugar de</legend>
          <p className={styles.hint}>Hasta 2, si aplica.</p>
          <div className={styles.positions}>
            {positions
              .filter((pos) => pos !== primary)
              .map((pos) => {
                const on = secondary.includes(pos);
                return (
                  <button
                    key={pos}
                    type="button"
                    className={styles.choice}
                    aria-pressed={on}
                    disabled={!on && secondary.length === 2}
                    onClick={() => toggleSecondary(pos)}
                  >
                    <span className={styles.number}>{POSITIONS[pos].number}</span>
                    <span>{POSITIONS[pos].name}</span>
                  </button>
                );
              })}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Qué tan seguro estás</legend>
          <div className={styles.confidence}>
            {CONFIDENCE.map((c) => (
              <label key={c.value} className={styles.segment}>
                <input
                  type="radio"
                  name="confidence"
                  checked={confidence === c.value}
                  onChange={() => setConfidence(c.value)}
                />
                <span className={styles.segmentValue}>{c.value}</span>
                <span className={styles.segmentLabel}>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.fieldset}>
          <label htmlFor={notesId} className={styles.label}>
            Notas (opcional)
          </label>
          <textarea
            id={notesId}
            name="notes"
            autoComplete="off"
            className={styles.textarea}
            rows={3}
            maxLength={500}
            value={notes}
            placeholder="Ej.: ordena bien la línea y gana por arriba…"
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className={styles.hint}>Solo las ve el cuerpo técnico, nunca el jugador.</p>
        </div>

        {error && (
          <p role="alert" className={styles.fieldError}>
            {error}
          </p>
        )}
        <Button type="submit" busy={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Guardar valoración'}
        </Button>
      </form>
    </Screen>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className={styles.back}>
      {to.endsWith('/plantilla') ? 'Volver a la plantilla' : 'Volver a la ficha'}
    </Link>
  );
}
