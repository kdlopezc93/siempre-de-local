import type { TeamScorersResponse } from '@sdl/contracts';
import { useState } from 'react';

import { Segmented } from '../../shared/ui/Segmented';
import styles from './Scorers.module.css';
import { useScorers } from './use-matches';

type Board = 'goals' | 'assists' | 'cards';
type Row = TeamScorersResponse['players'][number];

const BOARDS = [
  { value: 'goals', label: 'Goles' },
  { value: 'assists', label: 'Asistencias' },
  { value: 'cards', label: 'Tarjetas' },
] as const;

/** Los de una tabla, de más a menos: goles, asistencias o tarjetas (las rojas pesan más). */
export function boardRows(players: readonly Row[], board: Board): Row[] {
  const score = (p: Row) =>
    board === 'goals' ? p.goals : board === 'assists' ? p.assists : p.red * 2 + p.yellow;
  return players
    .filter((p) => score(p) > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) || a.player.displayName.localeCompare(b.player.displayName, 'es'),
    );
}

/**
 * Goleadores, asistencias y tarjetas de la temporada (2026-11-06): para todo el equipo, en
 * Partidos. El primero de la tabla va resaltado en volt. Sin nada cargado, no aparece.
 */
export function Scorers({ teamId }: { teamId: string }) {
  const scorers = useScorers(teamId);
  const players = scorers.data?.players ?? [];
  const has = (board: Board) => boardRows(players, board).length > 0;
  const [board, setBoard] = useState<Board>('goals');
  if (!BOARDS.some((b) => has(b.value))) return null;
  const rows = boardRows(players, board);
  return (
    <section aria-labelledby="goleadores" className={styles.section}>
      <h2 id="goleadores" className={styles.title}>
        Goleadores
      </h2>
      <Segmented label="Tabla de" options={BOARDS} value={board} onChange={setBoard} />
      {rows.length === 0 ? (
        <p className={styles.muted}>
          {board === 'assists' ? 'Todavía no hay asistencias.' : 'Ninguna tarjeta. Bien ahí.'}
        </p>
      ) : (
        <ol className={styles.table}>
          {rows.map((p, i) => (
            <li key={p.player.id} className={i === 0 ? styles.leader : undefined}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.name}>
                {p.player.jerseyNumber !== null && (
                  <span className={styles.jersey}>{p.player.jerseyNumber}</span>
                )}
                {p.player.displayName}
              </span>
              {board === 'cards' ? (
                <span className={styles.cards}>
                  {Array.from({ length: p.yellow }, (_, k) => (
                    <span key={`y${k}`} className={styles.card} data-color="yellow" />
                  ))}
                  {Array.from({ length: p.red }, (_, k) => (
                    <span key={`r${k}`} className={styles.card} data-color="red" />
                  ))}
                  <span className="sr-only">
                    {p.yellow} {p.yellow === 1 ? 'amarilla' : 'amarillas'}, {p.red}{' '}
                    {p.red === 1 ? 'roja' : 'rojas'}
                  </span>
                </span>
              ) : (
                <span className={styles.value}>{board === 'goals' ? p.goals : p.assists}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
