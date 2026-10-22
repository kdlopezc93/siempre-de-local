import type { SquadPlayer } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';
import { useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Pitch } from '../../shared/ui/Pitch';
import { Screen } from '../../shared/ui/Screen';
import { useTeam } from '../team-admin/use-invitations';
import { distribution, type DistributionSource } from './distribution';
import styles from './SquadPage.module.css';
import { useSquad } from './use-squad';

const SOURCES: { value: DistributionSource; label: string; empty: string }[] = [
  { value: 'staff', label: 'Cuerpo técnico', empty: 'sin valorar' },
  { value: 'test', label: 'Test', empty: 'sin test a la vista' },
  { value: 'preferred', label: 'Preferidas', empty: 'sin preferidas' },
];

/** /equipos/:teamId/plantilla — la plantilla del cuerpo técnico. */
export function SquadPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const [source, setSource] = useState<DistributionSource>('staff');

  if (team.isPending || squad.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando la plantilla…
        </p>
      </Screen>
    );
  }
  if (team.isError || squad.isError) {
    const forbidden = [team.error, squad.error].some(
      (e) => e instanceof ApiError && (e.status === 403 || e.status === 404),
    );
    return (
      <Screen className={styles.screen}>
        <BackLink />
        <h1 className={styles.title}>Plantilla</h1>
        <p role="alert" className={styles.muted}>
          {forbidden
            ? 'Solo el cuerpo técnico y los administradores del club ven la plantilla.'
            : 'No pudimos cargar la plantilla. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }

  const format = team.data.team.format;
  const players = squad.data.players;
  const { counts, gaps, unknown } = distribution(players, source, format);
  const sourceInfo = SOURCES.find((s) => s.value === source)!;

  return (
    <Screen className={styles.screen}>
      <BackLink />
      <header>
        <h1 className={styles.title}>Plantilla</h1>
        <p className={styles.muted}>
          {team.data.team.name}: {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
        </p>
      </header>

      <section aria-labelledby="reparto" className={styles.section}>
        <h2 id="reparto" className={styles.sectionTitle}>
          Reparto
        </h2>
        <fieldset className={styles.sources}>
          <legend className="sr-only">Contar según</legend>
          {SOURCES.map((s) => (
            <label key={s.value} className={styles.source}>
              <input
                type="radio"
                name="source"
                value={s.value}
                checked={source === s.value}
                onChange={() => setSource(s.value)}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </fieldset>
        <div className={styles.board}>
          <Pitch
            format={format}
            counts={counts}
            label={`Reparto según ${sourceInfo.label.toLowerCase()}: ${describeCounts(counts)}`}
          />
        </div>
        <p className={styles.gaps}>
          {gaps.length === 0
            ? 'Sin huecos: hay al menos uno en cada posición.'
            : `Huecos: ${gaps.map((pos) => POSITIONS[pos].name).join(', ')}.`}
        </p>
        {unknown > 0 && (
          <p className={styles.muted}>
            {unknown} {unknown === 1 ? 'jugador' : 'jugadores'} {sourceInfo.empty}.
          </p>
        )}
      </section>

      <section aria-labelledby="jugadores" className={styles.section}>
        <h2 id="jugadores" className={styles.sectionTitle}>
          Jugadores
        </h2>
        {players.length === 0 ? (
          <p className={styles.muted}>
            Todavía no hay jugadores.{' '}
            <Link to={`/equipos/${teamId}/invitar`}>Invita a tu equipo</Link>.
          </p>
        ) : (
          <ul className={styles.players}>
            {players.map((player) => (
              <li key={player.userId}>
                <PlayerRow teamId={teamId} player={player} />
              </li>
            ))}
          </ul>
        )}
        <p className={styles.muted}>
          El test de cada jugador aparece cuando lo valoras: así tu primera valoración es a ciegas y
          sirve para saber si el test acierta.
        </p>
      </section>
    </Screen>
  );
}

function describeCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([pos, n]) => `${POSITIONS[pos as keyof typeof POSITIONS].name} ${n}`)
    .join(', ');
}

function BackLink() {
  return (
    <Link to="/" className={styles.back}>
      Volver al inicio
    </Link>
  );
}

const name = (pos: keyof typeof POSITIONS) => POSITIONS[pos].name;

function PlayerRow({ teamId, player }: { teamId: string; player: SquadPlayer }) {
  const { test, latestAssessment } = player;
  return (
    <article className={styles.player}>
      <header className={styles.playerHead}>
        <h3 className={styles.playerName}>
          {player.jerseyNumber !== null && (
            <span className={styles.jersey}>{player.jerseyNumber}</span>
          )}
          {player.displayName}
        </h3>
        <Link
          to={`/equipos/${teamId}/plantilla/${player.userId}/valorar`}
          className={styles.assess}
          aria-label={`${player.assessedByMe ? 'Volver a valorar' : 'Valorar'} a ${player.displayName}`}
        >
          {player.assessedByMe ? 'Volver a valorar' : 'Valorar'}
        </Link>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>Cuerpo técnico</dt>
          <dd>
            {latestAssessment
              ? `${name(latestAssessment.primaryPosition)}${latestAssessment.secondaryPositions.length ? ` (también ${latestAssessment.secondaryPositions.map(name).join(', ')})` : ''}`
              : 'Sin valorar'}
          </dd>
        </div>
        <div>
          <dt>Test</dt>
          <dd className={test.status === 'hidden' ? styles.hidden : undefined}>
            {test.status === 'none'
              ? 'Todavía no lo hace'
              : test.status === 'hidden'
                ? 'Valóralo para verlo'
                : test.podium.map(name).join(', ')}
          </dd>
        </div>
        <div>
          <dt>Prefiere</dt>
          <dd>
            {player.preferredPositions.length
              ? player.preferredPositions.map(name).join(', ')
              : 'No lo dijo'}
          </dd>
        </div>
      </dl>
    </article>
  );
}
