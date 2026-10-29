import type { MatchFormat, SquadPlayer } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
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
import { StatGrid, StatTile } from '../../shared/ui/StatTile';
import { Sheet } from '../../shared/ui/Sheet';
import { useTeam } from '../team-admin/use-invitations';
import { distribution, type DistributionSource } from './distribution';
import {
  cardAverage,
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
import { useExportTeam, useRemindTest, useSquad } from './use-squad';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/IconButton';
import { PageTitle } from '../../shared/ui/PageTitle';

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
  // Recordar el test es del cuerpo técnico; el admin del club ve la plantilla, pero no avisa.
  const canRemind = myRoles.includes('coach') || myRoles.includes('assistant');

  return (
    <Screen className={styles.screen}>
      <PageTitle
        eyebrow={team.data.team.name}
        title="Plantilla"
        actions={
          canRemind || canExport ? (
            <IconButton
              to={`/equipos/${teamId}/invitar`}
              label="Invitar jugadores"
              icon={<UserPlus size={20} />}
              variant="brand"
            />
          ) : null
        }
      />
      {players.length > 0 && <SquadSummary players={players} />}
      <Segmented
        label="Ver como"
        options={VIEWS}
        value={view}
        onChange={(v) => setParam({ vista: v === 'lista' ? '' : v })}
      />

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
          canRemind={canRemind}
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
  canRemind,
  onQuery,
  onFilters,
  onClear,
}: {
  teamId: string;
  players: SquadPlayer[];
  format: MatchFormat;
  query: string;
  filters: ReadonlySet<SquadFilter>;
  canRemind: boolean;
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
      {canRemind && filters.has('sin-test') && counts['sin-test'] > 0 && (
        <TestReminder teamId={teamId} pending={counts['sin-test']} />
      )}
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

/** De un vistazo: cuántos son, a cuántos falta valorar y cuántos están lesionados. */
function SquadSummary({ players }: { players: SquadPlayer[] }) {
  const toRate = players.filter((p) => p.canRate && !p.assessedByMe).length;
  const injured = players.filter((p) => p.injury !== null).length;
  return (
    <StatGrid>
      <StatTile label="Jugadores" value={players.length} tone="brand" />
      <StatTile label="Por valorar" value={toRate} tone={toRate > 0 ? 'sun' : 'white'} />
      <StatTile label="Lesionados" value={injured} tone={injured > 0 ? 'coral' : 'white'} />
    </StatGrid>
  );
}

/** La insignia de estado de cada jugador: lo que pide atención primero, si no "Al día". */
function playerStatus(player: SquadPlayer): { tone: BadgeTone; label: string } {
  if (player.injury) return { tone: 'danger', label: 'Lesionado' };
  if (player.knowledge.some((k) => k.review === 'expired')) {
    return { tone: 'danger', label: 'Vencida' };
  }
  if (player.canRate && !player.assessedByMe) return { tone: 'warning', label: 'Valorar' };
  if (player.test.status === 'none') return { tone: 'neutral', label: 'Sin test' };
  return { tone: 'success', label: 'Al día' };
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
  const media = cardAverage(player, format);
  const status = playerStatus(player);
  // Dos líneas, como las filas del sistema: quién es en la cancha y cómo viene.
  const who = [
    positionLabel(player),
    player.jerseyNumber !== null && `dorsal ${player.jerseyNumber}`,
  ]
    .filter(Boolean)
    .join(', ');
  const how = [
    player.injury && injuryText(player.injury, todayIso()),
    media !== null ? `media ${media}` : 'sin tarjeta',
    player.test.status === 'none' && 'sin test',
    player.knowledge.some((k) => k.review === 'expired') && 're-evaluación vencida',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Row
      to={`/equipos/${teamId}/plantilla/${player.userId}`}
      leading={
        <Avatar
          name={player.displayName}
          label={player.jerseyNumber !== null ? String(player.jerseyNumber) : null}
          line={lineOf(player)}
          injured={player.injury !== null}
        />
      }
      title={player.displayName}
      meta={
        <>
          {who}
          <br />
          {how.charAt(0).toUpperCase() + how.slice(1)}
        </>
      }
      trailing={
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
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

/**
 * Recordarles el test a los que no lo han hecho (2026-10-26): un aviso al celular de los que
 * activaron los avisos; en el inicio ya les aparece.
 */
function TestReminder({ teamId, pending }: { teamId: string; pending: number }) {
  const remind = useRemindTest(teamId);
  const [confirm, setConfirm] = useState(false);
  const people = pending === 1 ? 'al que no lo ha hecho' : `a los ${pending} que no lo han hecho`;
  return (
    <div className={styles.reminder}>
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Recordarles el test
      </Button>
      <p className={styles.muted} aria-live="polite">
        {remind.isSuccess &&
          `Listo: se lo recordamos a ${remind.data.reminded === 1 ? '1 jugador' : `${remind.data.reminded} jugadores`}.`}
      </p>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Recordarles el test?">
        <div className={styles.sheetActions}>
          <p className={styles.sheetText}>
            Le llega un aviso al celular {people}, si activaron los avisos. Igual lo ven en el
            inicio de la app.
          </p>
          {remind.isError && (
            <p role="alert" className={styles.error}>
              No pudimos mandar el recordatorio. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button
            busy={remind.isPending}
            onClick={() => remind.mutate(undefined, { onSuccess: () => setConfirm(false) })}
          >
            Sí, recordarles
          </Button>
          <Button variant="ghost" disabled={remind.isPending} onClick={() => setConfirm(false)}>
            No
          </Button>
        </div>
      </Sheet>
    </div>
  );
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
