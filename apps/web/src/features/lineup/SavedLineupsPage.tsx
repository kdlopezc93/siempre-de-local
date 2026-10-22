import { findFormation, MODE_LABELS, POSITIONS } from '@sdl/domain';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useTeam } from '../team-admin/use-invitations';
import { LineupBoard } from './LineupBoard';
import styles from './PlannerPage.module.css';
import { SlotBreakdown } from './SlotBreakdown';
import { useDeleteLineup, useLineup, useLineups } from './use-lineups';
import { useLineupInputs } from './use-planner';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short', year: 'numeric' });
const day = (iso: string) => DAY.format(new Date(`${iso.slice(0, 10)}T12:00:00`));

/** /equipos/:teamId/alineaciones — las alineaciones guardadas. */
export function SavedLineupsPage({ teamId }: { teamId: string }) {
  const lineups = useLineups(teamId);
  return (
    <Screen className={styles.screen}>
      <Link to={`/equipos/${teamId}/planificador`} className={styles.back}>
        Volver al planificador
      </Link>
      <h1 className={styles.title}>Alineaciones</h1>
      {lineups.isPending ? (
        <p className="sr-only" role="status">
          Cargando…
        </p>
      ) : lineups.isError ? (
        <p role="alert">
          No pudimos cargar las alineaciones. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : lineups.data.items.length === 0 ? (
        <p className={styles.muted}>
          Todavía no guardaste ninguna.{' '}
          <Link to={`/equipos/${teamId}/planificador`}>Arma la primera</Link>.
        </p>
      ) : (
        <ul className={styles.savedList}>
          {lineups.data.items.map((l) => (
            <li key={l.id}>
              <Link to={`/equipos/${teamId}/alineaciones/${l.id}`} className={styles.savedItem}>
                <span className={styles.savedName}>{l.name}</span>
                <span className={styles.muted}>
                  {[
                    l.matchDate && day(l.matchDate),
                    findFormation(l.formation)?.label ?? l.formation,
                    l.createdBy?.name,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

/** /equipos/:teamId/alineaciones/:lineupId — tal como se guardó. */
export function LineupViewPage({ teamId, lineupId }: { teamId: string; lineupId: string }) {
  const team = useTeam(teamId);
  const lineup = useLineup(teamId, lineupId);
  const inputs = useLineupInputs(teamId);
  const remove = useDeleteLineup(teamId);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const back = (
    <Link to={`/equipos/${teamId}/alineaciones`} className={styles.back}>
      Volver a las alineaciones
    </Link>
  );

  if (lineup.isPending || team.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }
  const formation = lineup.data ? findFormation(lineup.data.formation) : undefined;
  if (lineup.isError || team.isError || !formation) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">No encontramos esa alineación.</p>
      </Screen>
    );
  }
  const l = lineup.data;
  const names = new Map(inputs.data?.players.map((p) => [p.playerId, p.displayName]));
  const jerseys = new Map(inputs.data?.players.map((p) => [p.playerId, p.jerseyNumber]));
  const nameOf = (id: string) => names.get(id) ?? 'Ya no está en el equipo';
  const manual = new Set(l.assignments.filter((a) => a.manual).map((a) => a.slotId));
  const detail = selected ? l.assignments.find((a) => a.slotId === selected) : undefined;
  const detailSlot = selected ? formation.slots.find((s) => s.id === selected) : undefined;
  const writes = team.data.myRoles.some((r) => r === 'coach' || r === 'assistant');

  return (
    <Screen className={styles.screen}>
      {back}
      <header>
        <h1 className={styles.title}>{l.name}</h1>
        <p className={styles.muted}>
          {[
            l.matchDate && day(l.matchDate),
            formation.label,
            MODE_LABELS[l.mode],
            l.createdBy && `armada por ${l.createdBy.name}`,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      </header>

      <LineupBoard
        formation={formation}
        assignments={l.assignments}
        names={
          new Map(
            l.assignments.flatMap((a) => (a.playerId ? [[a.playerId, nameOf(a.playerId)]] : [])),
          )
        }
        jerseys={jerseys}
        pinned={manual}
        selectedSlot={selected}
        armed={false}
        onTap={(slotId) => setSelected((s) => (s === slotId ? null : slotId))}
      />

      {detail?.playerId && detailSlot && (
        <section aria-labelledby="puesto" className={styles.detail}>
          <h2 id="puesto" className={styles.sectionTitle}>
            {POSITIONS[detailSlot.position].name}
            {detailSlot.side ? ` ${detailSlot.side}` : ''}
          </h2>
          <p className={styles.detailHead}>
            <span>{nameOf(detail.playerId)}</span>
            <span>
              {detail.fit === null ? '' : `${Math.round(detail.fit * 100)}% de encaje`}
              {detail.manual ? ', puesto a mano' : ''}
            </span>
          </p>
          <SlotBreakdown breakdown={detail.breakdown} />
        </section>
      )}

      <section aria-labelledby="banca" className={styles.section}>
        <h2 id="banca" className={styles.sectionTitle}>
          Suplentes ({l.bench.length})
        </h2>
        <p className={styles.muted}>
          {l.bench.length ? l.bench.map(nameOf).join(', ') : 'Ninguno.'}
        </p>
      </section>

      <p className={styles.note}>
        Es la foto de cuando se guardó: si después cambiaron tarjetas o exámenes, aquí no se mueve.
      </p>

      {writes && (
        <div className={styles.saveActions}>
          <Link
            to={`/equipos/${teamId}/planificador?alineacion=${l.id}`}
            className={styles.primaryLink}
          >
            Editar en el planificador
          </Link>
          {confirming ? (
            <>
              <p>¿Borrar “{l.name}”? No se puede deshacer.</p>
              <Button
                variant="secondary"
                busy={remove.isPending}
                onClick={() =>
                  remove.mutate(l.id, {
                    onSuccess: () => void navigate(`/equipos/${teamId}/alineaciones`),
                  })
                }
              >
                Sí, borrarla
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                No
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Borrar
            </Button>
          )}
          {remove.isError && (
            <p role="alert" className={styles.error}>
              No pudimos borrarla. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </Screen>
  );
}
