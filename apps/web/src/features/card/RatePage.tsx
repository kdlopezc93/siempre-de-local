import type { MatchFormat, PlayerRating, PositionCode } from '@sdl/contracts';
import {
  anchorFor,
  ELIGIBLE_POSITIONS,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  positionAverages,
  positionName,
  RATING_ATTRIBUTES,
  type RatingAttributeCode,
} from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { useBackTo } from '../squad/back';
import { useSquad } from '../squad/use-squad';
import { whyCannotRate } from '../squad/who-rates';
import { useSession } from '../auth/use-session';
import { useTeam } from '../team-admin/use-invitations';
import { cardPositionIn, rankedAverages } from './card-view';
import styles from './RatePage.module.css';
import { useCreateRating, useRatingHistory } from './use-card';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Avatar } from '../../shared/ui/Avatar';

/** Sin foto anterior, todo arranca en el nivel medio del equipo. */
const START = 60;

/** /equipos/:teamId/plantilla/:playerId/tarjeta/puntuar — una foto nueva de la tarjeta. */
export function RatePage({ teamId, playerId }: { teamId: string; playerId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const session = useSession();
  const history = useRatingHistory(teamId, playerId);

  const cardPath = useBackTo(`/equipos/${teamId}/plantilla/${playerId}/tarjeta`);
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
          {cardPath.endsWith('/tarjeta') ? 'Volver a la tarjeta' : 'Volver a la ficha'}
        </Link>
        <p role="alert">Ese jugador no está en la plantilla.</p>
      </Screen>
    );
  }
  if (!player.canRate) {
    return (
      <Screen className={styles.screen}>
        <Link to={cardPath} className={styles.back}>
          {cardPath.endsWith('/tarjeta') ? 'Volver a la tarjeta' : 'Volver a la ficha'}
        </Link>
        <p role="alert">{whyCannotRate(playerId, session.data?.user.id)}</p>
      </Screen>
    );
  }
  return (
    <RateForm
      teamId={teamId}
      playerId={playerId}
      name={player.displayName}
      jersey={player.jerseyNumber}
      format={team.data.team.format}
      previous={history.data[0]}
      suggested={history.data[0]?.position ?? player.latestAssessment?.primaryPosition ?? null}
      mightKeep={player.preferredPositions.includes('POR')}
      cardPath={cardPath}
    />
  );
}

function RateForm({
  teamId,
  playerId,
  name,
  jersey,
  format,
  previous,
  suggested,
  mightKeep,
  cardPath,
}: {
  teamId: string;
  playerId: string;
  name: string;
  jersey: number | null;
  format: MatchFormat;
  previous: PlayerRating | undefined;
  /** La de su foto anterior o, si no, la principal de su última valoración. */
  suggested: PositionCode | null;
  mightKeep: boolean;
  cardPath: string;
}) {
  const navigate = useNavigate();
  const create = useCreateRating(teamId, playerId);
  // Se parte de la foto anterior: puntuar de nuevo es mover lo que cambió.
  const [start] = useState(() => ({
    values: Object.fromEntries(
      [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES].map((code) => [
        code,
        previous?.values[code] ?? START,
      ]),
    ) as Record<RatingAttributeCode, number>,
    goalkeeper: previous ? previous.values.GK_DIV !== undefined : mightKeep,
    position: suggested && cardPositionIn(suggested, format),
  }));
  const [values, setValues] = useState(start.values);
  const [goalkeeper, setGoalkeeper] = useState(start.goalkeeper);
  const [picked, setPicked] = useState(start.position);
  const [notes, setNotes] = useState('');
  const guard = useUnsavedChanges(
    notes.trim() !== '' ||
      goalkeeper !== start.goalkeeper ||
      picked !== start.position ||
      Object.entries(values).some(
        ([code, value]) => start.values[code as RatingAttributeCode] !== value,
      ),
  );
  const notesId = useId();

  const sent = Object.fromEntries(
    (goalkeeper ? [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES] : OUTFIELD_ATTRIBUTES).map(
      (code) => [code, values[code]],
    ),
  ) as Record<RatingAttributeCode, number>;
  const averages = positionAverages(sent);
  const preview = rankedAverages(averages, format).slice(0, 3);
  // Sin elegir (o portero sin sus atributos), la tarjeta sigue a su mejor media.
  const position = picked && averages[picked] !== undefined ? picked : preview[0]?.pos;
  const choices = ELIGIBLE_POSITIONS[format].filter((pos) => averages[pos] !== undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate(
      {
        values: sent as Parameters<typeof create.mutate>[0]['values'],
        notes: notes.trim() || undefined,
        position,
      },
      {
        onSuccess: () => {
          guard.release();
          void navigate(cardPath);
        },
      },
    );
  }

  const error =
    create.error instanceof ApiError && create.error.status < 500
      ? create.error.message
      : create.isError
        ? 'No pudimos guardar la tarjeta. Revisa tu conexión e intenta de nuevo.'
        : null;

  const keeperGroup = (
    <>
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
    </>
  );

  return (
    <Screen className={styles.screen}>
      {guard.prompt}
      <Link to={cardPath} className={styles.back}>
        {cardPath.endsWith('/tarjeta') ? 'Volver a la tarjeta' : 'Volver a la ficha'}
      </Link>
      <header>
        <PageTitle
          eyebrow="Puntuar a"
          title={name}
          actions={<Avatar name={name} size={56} label={jersey !== null ? String(jersey) : null} />}
        />
        <p className={styles.lead}>
          {previous
            ? 'Arranca de su última foto: mueve lo que cambió. La anterior queda en su historial.'
            : 'Mídelo contra el nivel de tu categoría, no contra el fútbol profesional.'}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Si ya ataja, lo suyo de portero va primero. */}
        {start.goalkeeper && keeperGroup}
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
        {!start.goalkeeper && keeperGroup}

        <div className={styles.preview}>
          <p className={styles.legend}>Así queda</p>
          <ol className={styles.previewList}>
            {preview.map(({ pos, value }) => (
              <li key={pos}>
                <span className={styles.previewValue}>{value}</span> {positionName(pos, format)}
              </li>
            ))}
          </ol>
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Su posición en la tarjeta</legend>
          <p className={styles.hint}>Sale arriba en su tarjeta, aunque su mejor media sea otra.</p>
          <div className={styles.positions}>
            {choices.map((pos) => (
              <label key={pos} className={styles.choice}>
                <input
                  type="radio"
                  name="position"
                  checked={position === pos}
                  onChange={() => setPicked(pos)}
                />
                <span className={styles.choiceName}>{positionName(pos, format)}</span>
                <span className={styles.choiceValue}>
                  <span className="sr-only">, media </span>
                  {averages[pos]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
    // El color dice el nivel: carencia, por debajo, medio, destaca (y la palabra lo repite).
    <div className={styles.slider} data-band={anchor.min}>
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
