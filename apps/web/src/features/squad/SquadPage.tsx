import type { MatchFormat, SquadPlayer } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Chips } from '../../shared/ui/Chips';
import { Pitch } from '../../shared/ui/Pitch';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { SearchField } from '../../shared/ui/SearchField';
import { Segmented } from '../../shared/ui/Segmented';
import { Sheet } from '../../shared/ui/Sheet';
import { Token } from '../../shared/ui/Token';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useTeam } from '../team-admin/use-invitations';
import { distribution, type DistributionSource } from './distribution';
import {
  bestAverage,
  filterCounts,
  filterSquad,
  LINE_FILTERS,
  lineOf,
  parseFilters,
  positionLabel,
  serializeFilters,
  STATUS_FILTERS,
  type SquadFilter,
} from './squad-filters';
import styles from './SquadPage.module.css';
import { injuryText, todayIso } from './injury';
import { useExportTeam, useSquad } from './use-squad';

type View = 'lista' | 'pizarra';
const VIEWS = [
  { value: 'lista', label: 'Lista' },
  { value: 'pizarra', label: 'Pizarra' },
] as const;
const SOURCES = [
  { value: 'staff', label: 'Cuerpo técnico' },
  { value: 'test', label: 'Test' },
  { value: 'preferred', label: 'Preferidas' },
] as const;
const SOURCE_EMPTY: Record<DistributionSource, string> = {
  staff: 'sin valorar',
  test: 'sin test a la vista',
  preferred: 'sin preferidas',
};

/**
 * /equipos/:teamId/plantilla — una fila por jugador, con buscador y filtros; o la pizarra
 * del reparto. Vista, búsqueda y filtros viven en la URL (`?vista=`, `?q=`, `?filtro=`):
 * los enlaces del inicio llegan filtrados y "atrás" vuelve a como estaba.
 */
export function SquadPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vista') === 'pizarra' ? 'pizarra' : 'lista';
  // Todo cambio de la URL en una sola llamada: dos seguidas se pisan.
  const setParam = (changes: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

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

  const players = squad.data.players;
  const format = team.data.team.format;
  // El coach o el admin del club (que entra sin roles en el equipo); el asistente no.
  const myRoles = team.data.myRoles;
  const canExport = myRoles.includes('coach') || myRoles.length === 0;

  return (
    <Screen className={styles.screen}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Plantilla</h1>
        <Segmented
          label="Ver como"
          options={VIEWS}
          value={view}
          onChange={(v) => setParam({ vista: v === 'lista' ? '' : v })}
        />
      </div>

      {players.length === 0 ? (
        <p className={styles.empty}>
          Todavía no hay jugadores.{' '}
          <Link to={`/equipos/${teamId}/invitar`}>Invita a tu equipo</Link>.
        </p>
      ) : view === 'lista' ? (
        <ListView
          teamId={teamId}
          players={players}
          format={format}
          query={params.get('q') ?? ''}
          filters={parseFilters(params.get('filtro'))}
          onQuery={(q) => setParam({ q })}
          onFilters={(f) => setParam({ filtro: serializeFilters(f) })}
          onClear={() => setParam({ q: '', filtro: '' })}
        />
      ) : (
        <BoardView
          players={players}
          format={format}
          source={sourceFrom(params.get('fuente'))}
          onSource={(s) => setParam({ fuente: s === 'staff' ? '' : s })}
        />
      )}

      {canExport && players.length > 0 && <ExportButton teamId={teamId} />}
    </Screen>
  );
}

const sourceFrom = (raw: string | null): DistributionSource =>
  raw === 'test' || raw === 'preferred' ? raw : 'staff';

function ListView({
  teamId,
  players,
  format,
  query,
  filters,
  onQuery,
  onFilters,
  onClear,
}: {
  teamId: string;
  players: SquadPlayer[];
  format: MatchFormat;
  query: string;
  filters: ReadonlySet<SquadFilter>;
  onQuery: (q: string) => void;
  onFilters: (f: Set<SquadFilter>) => void;
  onClear: () => void;
}) {
  const [why, setWhy] = useState(false);
  const shown = filterSquad(players, query, filters);
  const counts = filterCounts(players);
  const toggle = (value: SquadFilter) => {
    const next = new Set(filters);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFilters(next);
  };
  // Los de estado, solo si hay alguno; las líneas, siempre.
  const options = [
    ...STATUS_FILTERS.filter((f) => counts[f.value] > 0 || filters.has(f.value)),
    ...LINE_FILTERS,
  ].map((f) => ({ ...f, count: counts[f.value] }));

  return (
    <>
      <SearchField
        label="Buscar jugador"
        placeholder="Nombre o dorsal…"
        value={query}
        onChange={onQuery}
      />
      <Chips label="Filtrar" options={options} selected={filters} onToggle={toggle} />
      <div className={styles.countRow}>
        <p className={styles.muted} aria-live="polite">
          {shown.length === players.length
            ? `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'}`
            : `${shown.length} de ${players.length}`}
        </p>
        {counts['por-valorar'] > 0 && (
          <button type="button" className={styles.why} onClick={() => setWhy(true)}>
            ¿Por qué valorar primero?
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className={styles.empty}>
          <p>Nadie con esa búsqueda o esos filtros.</p>
          <Button variant="ghost" onClick={onClear}>
            Ver a todos
          </Button>
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map((p) => (
            <li key={p.userId}>
              <PlayerRow teamId={teamId} player={p} format={format} />
            </li>
          ))}
        </ul>
      )}
      <Sheet open={why} onClose={() => setWhy(false)} title="Valorar primero, a ciegas">
        <p className={styles.sheetText}>
          El test de cada jugador aparece cuando lo valoras. Así tu primera valoración no se deja
          llevar por lo que dijo el test, y sirve para saber si el test acierta (lo ves en el
          informe de validación).
        </p>
      </Sheet>
    </>
  );
}

function PlayerRow({
  teamId,
  player,
  format,
}: {
  teamId: string;
  player: SquadPlayer;
  format: MatchFormat;
}) {
  const media = bestAverage(player, format);
  const notes = [
    player.test.status === 'none' && 'sin test',
    player.knowledge.some((k) => k.review === 'expired') && 're-evaluación vencida',
  ].filter(Boolean);
  return (
    <Row
      to={`/equipos/${teamId}/plantilla/${player.userId}`}
      leading={
        <Token
          text={
            player.jerseyNumber !== null
              ? String(player.jerseyNumber)
              : initialsOf(player.displayName)
          }
          line={lineOf(player)}
          injured={player.injury !== null}
        />
      }
      title={player.displayName}
      // Lesionado va primero: en 360 px la línea se corta por el final.
      meta={[
        player.injury && injuryText(player.injury, todayIso()),
        positionLabel(player),
        ...notes,
      ]
        .filter(Boolean)
        .join(', ')}
      trailing={
        <>
          {player.canRate && !player.assessedByMe && (
            <span className={styles.flag}>
              <Warning size={16} weight="fill" aria-hidden="true" />
              Valorar
            </span>
          )}
          <span className={styles.media}>
            {media ?? '–'}
            <span className="sr-only">{media !== null ? ' de media' : ' sin tarjeta'}</span>
          </span>
        </>
      }
    />
  );
}

function BoardView({
  players,
  format,
  source,
  onSource,
}: {
  players: SquadPlayer[];
  format: MatchFormat;
  source: DistributionSource;
  onSource: (s: DistributionSource) => void;
}) {
  const { roster, gaps, unknown } = distribution(players, source, format);
  const label = SOURCES.find((s) => s.value === source)!.label;
  return (
    <section aria-label="Reparto" className={styles.board}>
      <Segmented label="Contar según" options={SOURCES} value={source} onChange={onSource} />
      <div className={styles.pitch}>
        <Pitch
          format={format}
          roster={roster}
          label={`Reparto según ${label.toLowerCase()}: ${describeRoster(roster)}`}
        />
      </div>
      <p>
        {gaps.length === 0
          ? 'Sin huecos: hay al menos uno en cada posición.'
          : `Huecos: ${gaps.map((pos) => POSITIONS[pos].name).join(', ')}.`}
      </p>
      {unknown > 0 && (
        <p className={styles.muted}>
          {unknown} {unknown === 1 ? 'jugador' : 'jugadores'} {SOURCE_EMPTY[source]}.
        </p>
      )}
    </section>
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

/** La plantilla en CSV: lo mismo que se ve aquí, sin notas y respetando la regla a ciegas. */
function ExportButton({ teamId }: { teamId: string }) {
  const exporter = useExportTeam(teamId);
  return (
    <div className={styles.export}>
      <button
        type="button"
        className={styles.why}
        disabled={exporter.isPending}
        aria-busy={exporter.isPending || undefined}
        onClick={() => exporter.mutate()}
      >
        {exporter.isPending ? 'Preparando…' : 'Descargar la plantilla (CSV)'}
      </button>
      {exporter.isError && (
        <p role="alert" className={styles.error}>
          No pudimos descargar el archivo. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </div>
  );
}
