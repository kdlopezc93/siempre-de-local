import type { MatchFormat, PlayerProfileResponse } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, POSITIONS, type PositionCode } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Screen } from '../../shared/ui/Screen';
import { RATED_ON } from '../card/card-view';
import { PlayerCard } from '../card/PlayerCard';
import { useTeam } from '../team-admin/use-invitations';
import styles from './PlayerProfilePage.module.css';
import { KnowledgeSection } from './KnowledgeSection';
import { agreement, jerseyHolders } from './profile-view';
import { usePlayerProfile, useSetJersey, useSquad } from './use-squad';

const FOOT = { left: 'Zurdo', right: 'Diestro', both: 'Ambidiestro' } as const;
const name = (pos: PositionCode) => POSITIONS[pos].name;
const percent = (pct: number) => `${Math.round(pct * 100)}%`;

/** /equipos/:teamId/plantilla/:playerId — todo lo de un jugador, para el cuerpo técnico. */
export function PlayerProfilePage({ teamId, playerId }: { teamId: string; playerId: string }) {
  const team = useTeam(teamId);
  const profile = usePlayerProfile(teamId, playerId);

  const back = (
    <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
      Volver a la plantilla
    </Link>
  );
  if (team.isPending || profile.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el perfil…
        </p>
      </Screen>
    );
  }
  if (team.isError || profile.isError) {
    const missing = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">
          {missing
            ? 'Ese jugador no está en la plantilla.'
            : 'No pudimos cargar el perfil. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }

  const data = profile.data;
  const { player } = data;
  const format = team.data.team.format;
  const rates = team.data.myRoles.some((role) => role === 'coach' || role === 'assistant');
  // El dorsal: el coach o el admin del club (que entra sin roles en el equipo).
  const managesMembers = team.data.myRoles.includes('coach') || team.data.myRoles.length === 0;
  const here = `/equipos/${teamId}/plantilla/${playerId}`;

  return (
    <Screen className={styles.screen}>
      {back}
      <header className={styles.head}>
        {player.jerseyNumber !== null && (
          <span className={styles.jersey}>
            <span className="sr-only">Dorsal </span>
            {player.jerseyNumber}
          </span>
        )}
        <div className={styles.headText}>
          <h1 className={styles.title}>{player.displayName}</h1>
          <p className={styles.muted}>
            {[
              player.dominantFoot && FOOT[player.dominantFoot],
              player.playsGoalkeeper && 'Dice que ataja',
            ]
              .filter(Boolean)
              .join('. ') || 'No completó su perfil.'}
          </p>
        </div>
      </header>
      {managesMembers && (
        <JerseyEditor teamId={teamId} playerId={playerId} current={player.jerseyNumber} />
      )}

      <WhereTheySee data={data} />

      {rates && (
        <div className={styles.actions}>
          <Link to={`${here}/valorar`} state={{ back: here }} className={styles.primaryLink}>
            {data.assessedByMe ? 'Volver a valorar' : 'Valorar'}
          </Link>
          <Link
            to={`${here}/tarjeta/puntuar`}
            state={{ back: here }}
            className={styles.secondaryLink}
          >
            {data.card ? 'Puntuar de nuevo' : 'Puntuar tarjeta'}
          </Link>
        </div>
      )}

      {data.test.status === 'visible' && (
        <TestSection
          ranking={data.test.ranking}
          format={format}
          submittedAt={data.test.submittedAt}
        />
      )}

      <section aria-labelledby="tarjeta" className={styles.section}>
        <h2 id="tarjeta" className={styles.sectionTitle}>
          Tarjeta
        </h2>
        {data.card ? (
          <>
            <PlayerCard card={data.card} format={format} headingLevel={3} />
            {data.cardCount > 1 && (
              <Link to={`${here}/tarjeta`} className={styles.back}>
                Ver las {data.cardCount - 1} fotos anteriores
              </Link>
            )}
          </>
        ) : (
          <p className={styles.muted}>Todavía nadie del cuerpo técnico lo puntuó.</p>
        )}
      </section>

      <KnowledgeSection
        teamId={teamId}
        playerId={playerId}
        knowledge={data.knowledge}
        manages={managesMembers}
      />

      <section aria-labelledby="valoraciones" className={styles.section}>
        <h2 id="valoraciones" className={styles.sectionTitle}>
          Valoraciones
        </h2>
        {data.assessments.length === 0 ? (
          <p className={styles.muted}>Todavía nadie del cuerpo técnico lo valoró.</p>
        ) : (
          <ul className={styles.list}>
            {data.assessments.map((a) => (
              <li key={a.id}>
                <div className={styles.listHead}>
                  <span className={styles.listPos}>{name(a.primaryPosition)}</span>
                  {a.blind && <span className={styles.tag}>A ciegas</span>}
                </div>
                {a.secondaryPositions.length > 0 && (
                  <p>También {a.secondaryPositions.map(name).join(', ')}</p>
                )}
                <p className={styles.muted}>
                  {RATED_ON.format(new Date(a.createdAt))}
                  {a.assessor && `, ${a.assessor.name}`}. Seguridad {a.confidence} de 5.
                </p>
                {a.notes && <p className={styles.notes}>“{a.notes}”</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

/** Lo central del perfil: dónde lo ve cada fuente y si coinciden. */
function WhereTheySee({ data }: { data: PlayerProfileResponse }) {
  const latest = data.assessments[0];
  const verdict = agreement(data);
  return (
    <section aria-labelledby="donde" className={styles.section}>
      <h2 id="donde" className={styles.sectionTitle}>
        Dónde lo ven
      </h2>
      <dl className={styles.sources}>
        <div>
          <dt>Cuerpo técnico</dt>
          <dd>
            {latest
              ? `${name(latest.primaryPosition)}${latest.secondaryPositions.length ? ` (también ${latest.secondaryPositions.map(name).join(', ')})` : ''}`
              : 'Sin valorar'}
          </dd>
        </div>
        <div>
          <dt>Test</dt>
          <dd className={data.test.status === 'hidden' ? styles.accent : undefined}>
            {data.test.status === 'none'
              ? 'Todavía no lo hace'
              : data.test.status === 'hidden'
                ? 'Valóralo para verlo'
                : data.test.podium.map(name).join(', ')}
          </dd>
        </div>
        <div>
          <dt>Sus preferidas</dt>
          <dd>
            {data.player.preferredPositions.length
              ? data.player.preferredPositions.map(name).join(', ')
              : 'No lo dijo'}
          </dd>
        </div>
      </dl>
      {verdict && (
        <p className={verdict === 'match' ? styles.match : styles.muted}>
          {verdict === 'match'
            ? `El test coincide: ${name(latest!.primaryPosition)} está en su podio.`
            : `El test lo ve distinto: ${name(latest!.primaryPosition)} no está en su podio.`}
        </p>
      )}
    </section>
  );
}

function TestSection({
  ranking,
  format,
  submittedAt,
}: {
  ranking: { pos: PositionCode; pct: number }[];
  format: MatchFormat;
  submittedAt: string;
}) {
  const eligible = new Set(ELIGIBLE_POSITIONS[format]);
  return (
    <section aria-labelledby="test" className={styles.section}>
      <h2 id="test" className={styles.sectionTitle}>
        Su test
      </h2>
      <p className={styles.muted}>
        Hecho el {RATED_ON.format(new Date(submittedAt))}. La afinidad compara sus posiciones entre
        sí; no sirve para comparar jugadores.
      </p>
      <ol className={styles.ranking}>
        {ranking
          .filter((entry) => eligible.has(entry.pos))
          .map((entry, i) => (
            <li key={entry.pos} className={i < 3 ? styles.podium : undefined}>
              <span>{name(entry.pos)}</span>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ transform: `scaleX(${entry.pct})` }} />
              </span>
              <span className={styles.pct}>{percent(entry.pct)}</span>
            </li>
          ))}
      </ol>
    </section>
  );
}

/** Lo pone el cuerpo técnico; puede repetirse (dos jugadores con la misma camiseta). */
function JerseyEditor({
  teamId,
  playerId,
  current,
}: {
  teamId: string;
  playerId: string;
  current: number | null;
}) {
  const setJersey = useSetJersey(teamId, playerId);
  // La plantilla casi siempre ya está en caché (se llega al perfil desde ella).
  const squad = useSquad(teamId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current?.toString() ?? '');
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const hintId = useId();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 99) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setJersey.mutate(n, { onSuccess: () => setEditing(false) });
  }

  const typed = value.trim() === '' ? null : Number(value);
  const holders =
    typed !== null && typed !== current && squad.data
      ? jerseyHolders(squad.data.players, typed, playerId)
      : [];

  if (!editing) {
    return (
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => {
          setValue(current?.toString() ?? '');
          setEditing(true);
        }}
      >
        {current === null ? 'Ponerle dorsal' : 'Cambiar dorsal'}
      </button>
    );
  }
  return (
    <form className={styles.jerseyForm} onSubmit={save} noValidate>
      <label htmlFor={inputId} className={styles.label}>
        Dorsal
      </label>
      <div className={styles.jerseyRow}>
        <input
          id={inputId}
          name="jersey"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="off"
          className={styles.jerseyInput}
          value={value}
          aria-invalid={invalid}
          aria-describedby={hintId}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className={styles.primaryLink} disabled={setJersey.isPending}>
          {setJersey.isPending ? 'Guardando…' : holders.length ? 'Guardar igual' : 'Guardar'}
        </button>
        <button
          type="button"
          className={styles.secondaryLink}
          onClick={() => setEditing(false)}
          disabled={setJersey.isPending}
        >
          Cancelar
        </button>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={invalid ? styles.error : holders.length ? styles.warning : styles.muted}
      >
        {invalid
          ? 'Escribe un número de 0 a 99.'
          : holders.length
            ? `El ${typed} ya lo usa ${listNames(holders)}. Si comparten camiseta, guárdalo igual.`
            : 'De 0 a 99. Puede repetirse si dos comparten camiseta.'}
      </p>
      {current !== null && (
        <button
          type="button"
          className={styles.linkButton}
          disabled={setJersey.isPending}
          onClick={() => setJersey.mutate(null, { onSuccess: () => setEditing(false) })}
        >
          Quitarle el dorsal
        </button>
      )}
      {setJersey.isError && (
        <p role="alert" className={styles.error}>
          No pudimos guardar el dorsal. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </form>
  );
}

function listNames(names: string[]): string {
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}
