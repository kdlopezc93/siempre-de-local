import type { MatchFormat, SquadPlayer } from '@sdl/contracts';
import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Pitch } from '../../shared/ui/Pitch';
import { Screen } from '../../shared/ui/Screen';
import { rankedAverages } from '../card/card-view';
import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import { distribution, type DistributionSource } from './distribution';
import styles from './SquadPage.module.css';
import { useExportTeam, useSquad } from './use-squad';

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
  // El coach o el admin del club (que entra sin roles en el equipo); el asistente no.
  const myRoles = team.data.myRoles;
  const canChangeSettings = myRoles.includes('coach') || myRoles.length === 0;
  const { roster, gaps, unknown } = distribution(players, source, format);
  const sourceInfo = SOURCES.find((s) => s.value === source)!;

  return (
    <Screen className={styles.screen}>
      <header>
        <h1 className={styles.title}>Plantilla</h1>
        <p className={styles.muted}>
          {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
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
            roster={roster}
            label={`Reparto según ${sourceInfo.label.toLowerCase()}: ${describeRoster(roster)}`}
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
                <PlayerRow teamId={teamId} player={player} format={format} />
              </li>
            ))}
          </ul>
        )}
        <p className={styles.muted}>
          El test de cada jugador aparece cuando lo valoras: así tu primera valoración es a ciegas y
          sirve para saber si el test acierta.
        </p>
      </section>

      {canChangeSettings && (
        <CardVisibility teamId={teamId} visible={team.data.team.ratingsVisibleToPlayers} />
      )}
    </Screen>
  );
}

function describeRoster(roster: Record<string, string[]>): string {
  return Object.entries(roster)
    .map(
      ([pos, names]) =>
        `${POSITIONS[pos as keyof typeof POSITIONS].name}: ${names.length ? names.join(', ') : 'hueco'}`,
    )
    .join('; ');
}

const name = (pos: keyof typeof POSITIONS) => POSITIONS[pos].name;

function PlayerRow({
  teamId,
  player,
  format,
}: {
  teamId: string;
  player: SquadPlayer;
  format: MatchFormat;
}) {
  const { test, latestAssessment, card } = player;
  const best = card ? rankedAverages(card.positionAverages, format)[0] : undefined;
  return (
    <article className={styles.player}>
      <header className={styles.playerHead}>
        <h3 className={styles.playerName}>
          {player.jerseyNumber !== null && (
            <span className={styles.jersey}>{player.jerseyNumber}</span>
          )}
          <Link to={`/equipos/${teamId}/plantilla/${player.userId}`} className={styles.playerLink}>
            {player.displayName}
          </Link>
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
          <dt>Tarjeta</dt>
          <dd>{best ? `${best.value} de media como ${name(best.pos)}` : 'Sin puntuar'}</dd>
        </div>
        <div>
          <dt>Conocimiento</dt>
          <dd>{knowledgeLine(player.knowledge)}</dd>
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
      <Link
        to={`/equipos/${teamId}/plantilla/${player.userId}/tarjeta`}
        className={styles.cardLink}
        aria-label={`Tarjeta de ${player.displayName}`}
      >
        {card ? 'Ver tarjeta' : 'Puntuar tarjeta'}
      </Link>
    </article>
  );
}

/** D8: si los jugadores ven su tarjeta en este equipo. */
function CardVisibility({ teamId, visible }: { teamId: string; visible: boolean }) {
  const update = useUpdateTeam(teamId);
  return (
    <section aria-labelledby="ajustes" className={styles.section}>
      <h2 id="ajustes" className={styles.sectionTitle}>
        Ajustes
      </h2>
      <label className={styles.setting}>
        <input
          type="checkbox"
          role="switch"
          checked={update.isPending ? !visible : visible}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ ratingsVisibleToPlayers: event.target.checked })}
        />
        <span>
          Los jugadores ven su tarjeta
          <span className={styles.settingHint}>
            {visible
              ? 'Cada uno ve la suya, sin tus notas.'
              : 'Solo el cuerpo técnico ve las tarjetas.'}
          </span>
        </span>
      </label>
      {update.isError && (
        <p role="alert" className={styles.error}>
          No pudimos cambiar el ajuste. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <ExportButton teamId={teamId} />
    </section>
  );
}

/** La plantilla en CSV: lo mismo que se ve aquí, sin notas y respetando la regla a ciegas. */
function ExportButton({ teamId }: { teamId: string }) {
  const exporter = useExportTeam(teamId);
  return (
    <>
      <Button variant="secondary" busy={exporter.isPending} onClick={() => exporter.mutate()}>
        {exporter.isPending ? 'Preparando…' : 'Descargar la plantilla (CSV)'}
      </Button>
      <p className={styles.muted}>
        Para abrir en Excel o Google Sheets. No lleva notas, y los tests que todavía no ves tampoco
        salen.
      </p>
      {exporter.isError && (
        <p role="alert" className={styles.error}>
          No pudimos descargar el archivo. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </>
  );
}

/** "Defensa central 80% (Sólido)"; marca la re-evaluación abierta. */
function knowledgeLine(knowledge: SquadPlayer['knowledge']): string {
  if (knowledge.length === 0) return 'Sin examen';
  return knowledge
    .map((k) => {
      const score =
        k.pct === null ? 'sin puntaje' : `${Math.round(k.pct * 100)}% (${BAND_LABELS[k.band!]})`;
      const review =
        k.review === 'expired' ? ', re-evaluación vencida' : k.review ? ', en re-evaluación' : '';
      return `${name(k.position)} ${score}${review}`;
    })
    .join('; ');
}
