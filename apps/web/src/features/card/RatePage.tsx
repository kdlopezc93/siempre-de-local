import type { MatchFormat, PlayerRating } from '@sdl/contracts';
import {
  anchorFor,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  POSITIONS,
  positionAverages,
  RATING_ATTRIBUTES,
  type RatingAttributeCode,
} from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useSquad } from '../squad/use-squad';
import { useTeam } from '../team-admin/use-invitations';
import { rankedAverages } from './card-view';
import styles from './RatePage.module.css';
import { useCreateRating, useRatingHistory } from './use-card';

/** Sin foto anterior, todo arranca en el nivel medio del equipo. */
const START = 60;

/** /equipos/:teamId/plantilla/:playerId/tarjeta/puntuar — una foto nueva de la tarjeta. */
export function RatePage({ teamId, playerId }: { teamId: string; playerId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const history = useRatingHistory(teamId, playerId);

  const cardPath = `/equipos/${teamId}/plantilla/${playerId}/tarjeta`;
  if (team.isPending || squad.isPending || history.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }
  const player = squad.data?.players.find((p) => p.userId === playerId);
  if (!team.data || !player || history.isError) {
    return (
      <Screen className={styles.screen}>
        <Link to={cardPath} className={styles.back}>
          Volver a la tarjeta
        </Link>
        <p role="alert">Ese jugador no está en la plantilla.</p>
      </Screen>
    );
  }
  return (
    <RateForm
      teamId={teamId}
      playerId={playerId}
      name={player.displayName}
      format={team.data.team.format}
      previous={history.data[0]}
      mightKeep={player.preferredPositions.includes('POR')}
      cardPath={cardPath}
    />
  );
}

function RateForm({
  teamId,
  playerId,
  name,
  format,
  previous,
  mightKeep,
  cardPath,
}: {
  teamId: string;
  playerId: string;
  name: string;
  format: MatchFormat;
  previous: PlayerRating | undefined;
  mightKeep: boolean;
  cardPath: string;
}) {
  const navigate = useNavigate();
  const create = useCreateRating(teamId, playerId);
  // Se parte de la foto anterior: puntuar de nuevo es mover lo que cambió.
  const [values, setValues] = useState<Record<RatingAttributeCode, number>>(
    () =>
      Object.fromEntries(
        [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES].map((code) => [
          code,
          previous?.values[code] ?? START,
        ]),
      ) as Record<RatingAttributeCode, number>,
  );
  const [goalkeeper, setGoalkeeper] = useState(
    previous ? previous.values.GK_DIV !== undefined : mightKeep,
  );
  const [notes, setNotes] = useState('');
  const notesId = useId();

  const sent = Object.fromEntries(
    (goalkeeper ? [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES] : OUTFIELD_ATTRIBUTES).map(
      (code) => [code, values[code]],
    ),
  ) as Record<RatingAttributeCode, number>;
  const preview = rankedAverages(positionAverages(sent), format).slice(0, 3);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate(
      {
        values: sent as Parameters<typeof create.mutate>[0]['values'],
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => void navigate(cardPath) },
    );
  }

  const error =
    create.error instanceof ApiError && create.error.status < 500
      ? create.error.message
      : create.isError
        ? 'No pudimos guardar la tarjeta. Revisa tu conexión e intenta de nuevo.'
        : null;

  return (
    <Screen className={styles.screen}>
      <Link to={cardPath} className={styles.back}>
        Volver a la tarjeta
      </Link>
      <header>
        <h1 className={styles.title}>Puntuar a {name}</h1>
        <p className={styles.lead}>
          {previous
            ? 'Arranca de su última foto: mueve lo que cambió. La anterior queda en su historial.'
            : 'Mídelo contra el nivel de tu categoría, no contra el fútbol profesional.'}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>De campo</legend>
          {OUTFIELD_ATTRIBUTES.map((code) => (
            <Slider
              key={code}
              code={code}
              value={values[code]}
              onChange={(v) => setValues((s) => ({ ...s, [code]: v }))}
            />
          ))}
        </fieldset>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={goalkeeper}
            onChange={(event) => setGoalkeeper(event.target.checked)}
          />
          <span>Juega o podría jugar de portero</span>
        </label>
        {goalkeeper && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>De portero</legend>
            {GOALKEEPER_ATTRIBUTES.map((code) => (
              <Slider
                key={code}
                code={code}
                value={values[code]}
                onChange={(v) => setValues((s) => ({ ...s, [code]: v }))}
              />
            ))}
          </fieldset>
        )}

        <div className={styles.preview}>
          <p className={styles.legend}>Así queda</p>
          <ol className={styles.previewList}>
            {preview.map(({ pos, value }) => (
              <li key={pos}>
                <span className={styles.previewValue}>{value}</span> {POSITIONS[pos].name}
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.group}>
          <label htmlFor={notesId} className={styles.legend}>
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
            placeholder="Ej.: mejoró mucho el pase largo…"
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className={styles.hint}>Solo las ve el cuerpo técnico, nunca el jugador.</p>
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" busy={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Guardar tarjeta'}
        </Button>
      </form>
    </Screen>
  );
}

function Slider({
  code,
  value,
  onChange,
}: {
  code: RatingAttributeCode;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const anchor = anchorFor(value);
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <label htmlFor={id}>{RATING_ATTRIBUTES[code].name}</label>
        <output htmlFor={id} className={styles.sliderValue}>
          {value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={99}
        step={1}
        value={value}
        aria-valuetext={`${value}: ${anchor.label}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className={styles.anchor}>{anchor.label}</p>
    </div>
  );
}
