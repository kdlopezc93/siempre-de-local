import type { Formation, SlotAssignment } from '@sdl/domain';
import { POSITIONS } from '@sdl/domain';
import type { KeyboardEvent } from 'react';

import { PitchLines } from '../../shared/ui/PitchLines';
import { percent } from '../../shared/format';
import styles from './LineupBoard.module.css';

/** Verde si encaja bien, volt si regular, rojo si es un parche. */
export function fitTone(fit: number | null): 'good' | 'fair' | 'weak' | 'empty' {
  if (fit === null) return 'empty';
  if (fit >= 0.65) return 'good';
  if (fit >= 0.4) return 'fair';
  return 'weak';
}

const short = (name: string) => {
  const first = name.split(' ')[0] ?? name;
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
};

/**
 * La pizarra del planificador: cada puesto de la formación con quien juega ahí. Se toca un
 * puesto y después otro (o un suplente) para cambiar.
 */
export function LineupBoard({
  formation,
  assignments,
  names,
  jerseys,
  pinned,
  selectedSlot,
  armed,
  onTap,
}: {
  formation: Formation;
  assignments: readonly SlotAssignment[];
  names: ReadonlyMap<string, string>;
  jerseys: ReadonlyMap<string, number | null>;
  pinned: ReadonlySet<string>;
  selectedSlot: string | null;
  /** Hay un suplente esperando su puesto: la pizarra lo marca. */
  armed: boolean;
  onTap: (slotId: string) => void;
}) {
  return (
    <svg
      viewBox="0 0 100 150"
      className={[styles.board, armed ? styles.armed : ''].join(' ')}
      aria-label={`Alineación ${formation.label}`}
      role="group"
    >
      <PitchLines />
      {formation.slots.map((slot) => {
        const a = assignments.find((x) => x.slotId === slot.id)!;
        const [x, y] = slot.coord;
        const name = a.playerId ? (names.get(a.playerId) ?? '') : null;
        const jersey = a.playerId ? jerseys.get(a.playerId) : null;
        const tone = fitTone(a.fit);
        const label = name
          ? `${POSITIONS[slot.position].name}${slot.side ? ` ${slot.side}` : ''}: ${name}, encaje ${percent(a.fit ?? 0)}${pinned.has(slot.id) ? ', fijado' : ''}`
          : `${POSITIONS[slot.position].name}${slot.side ? ` ${slot.side}` : ''}: vacío`;
        const onKey = (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onTap(slot.id);
          }
        };
        return (
          <g
            key={slot.id}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selectedSlot === slot.id}
            className={[
              styles.slot,
              styles[tone],
              selectedSlot === slot.id ? styles.selected : '',
            ].join(' ')}
            onClick={() => onTap(slot.id)}
            onKeyDown={onKey}
          >
            {/* Área táctil de ~44 px aunque el círculo se vea más chico. */}
            <circle cx={x} cy={y} r="8.5" className={styles.hit} />
            <circle cx={x} cy={y} r="6" className={styles.dot} />
            <text x={x} y={y + 1.6} className={styles.code}>
              {jersey ?? (name ? name.slice(0, 2).toUpperCase() : slot.position)}
            </text>
            <text x={x} y={y + 10.5} className={styles.name}>
              {name ? short(name) : 'vacío'}
            </text>
            {pinned.has(slot.id) && <circle cx={x + 5} cy={y - 5} r="1.8" className={styles.pin} />}
          </g>
        );
      })}
    </svg>
  );
}
