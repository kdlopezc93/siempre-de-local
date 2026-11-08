import type { BirthYears, CategoryGender, MatchFormat } from '@sdl/contracts';
import { agesHint, groupTeamName, suggestCategoryName, suggestGroupName } from '@sdl/domain';
import { useId } from 'react';

import { Segmented } from '../../shared/ui/Segmented';
import styles from './CreateClubPage.module.css';

/**
 * Los campos de una escuela (Kevin, 2026-11-07, `08` §10): la categoría por edad con sus años
 * de nacimiento, y el grupo con su género. Los usan Crear mi escuela y Nuevo grupo.
 */

const thisYear = () => new Date().getFullYear();
/** "o antes": la categoría abierta por abajo (mayores, 18+). */
const OPEN = 'antes';

export interface CategoryValues {
  category: string;
  /** El usuario escribió el nombre: ya no se sugiere con los años. */
  categoryTouched: boolean;
  from: number | null;
  to: number;
}

export const emptyCategory = (): CategoryValues => ({
  category: suggestCategoryName(thisYear() - 12, thisYear()),
  categoryTouched: false,
  from: thisYear() - 12,
  to: thisYear() - 11,
});

export const birthYearsOf = (v: CategoryValues): BirthYears => ({ from: v.from, to: v.to });

export function categoryProblem(v: CategoryValues): string | null {
  if (v.category.trim().length < 2) return 'Escribe el nombre de la categoría.';
  if (v.from !== null && v.from > v.to) return 'El primer año va antes del último.';
  return null;
}

/** Los años que se ofrecen: de 3 a 60 años de edad, del más reciente al más viejo. */
function yearOptions() {
  const now = thisYear();
  return Array.from({ length: 58 }, (_, i) => now - 3 - i);
}

export function CategoryFields({
  value,
  onChange,
}: {
  value: CategoryValues;
  onChange: (value: CategoryValues) => void;
}) {
  const ids = { name: useId(), from: useId(), to: useId(), hint: useId() };
  const years = yearOptions();
  const setYears = (from: number | null, to: number) =>
    onChange({
      ...value,
      from,
      to,
      category: value.categoryTouched ? value.category : suggestCategoryName(from, thisYear()),
    });
  return (
    <>
      <span className={styles.label}>Nacidos entre</span>
      <div className={styles.yearsRow}>
        <label htmlFor={ids.from} className={styles.yearLabel}>
          Desde
          <select
            id={ids.from}
            className={styles.yearSelect}
            value={value.from === null ? OPEN : String(value.from)}
            aria-describedby={ids.hint}
            onChange={(event) => {
              const from = event.target.value === OPEN ? null : Number(event.target.value);
              setYears(from, from !== null && from > value.to ? from : value.to);
            }}
          >
            <option value={OPEN}>o antes</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={ids.to} className={styles.yearLabel}>
          Hasta
          <select
            id={ids.to}
            className={styles.yearSelect}
            value={String(value.to)}
            aria-describedby={ids.hint}
            onChange={(event) => {
              const to = Number(event.target.value);
              setYears(value.from !== null && value.from > to ? to : value.from, to);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p id={ids.hint} className={styles.hint}>
        {agesHint(birthYearsOf(value), thisYear())} Un solo año: el mismo en los dos. Para mayores,
        «Desde» en «o antes».
      </p>
      <label htmlFor={ids.name} className={styles.label}>
        Nombre de la categoría
      </label>
      <input
        id={ids.name}
        className={styles.input}
        value={value.category}
        maxLength={40}
        autoComplete="off"
        placeholder="Ej.: Sub-12"
        onChange={(event) =>
          onChange({ ...value, category: event.target.value, categoryTouched: true })
        }
      />
    </>
  );
}

export interface GroupValues {
  gender: CategoryGender;
  group: string;
  /** El usuario escribió el nombre: ya no se sugiere con el género. */
  groupTouched: boolean;
  format: MatchFormat;
  season: string;
  venueId: string | null;
}

export const emptyGroup = (sameGender: (g: CategoryGender) => number = () => 0): GroupValues => ({
  gender: 'male',
  group: suggestGroupName('male', sameGender('male')),
  groupTouched: false,
  format: 'F8',
  season: String(thisYear()),
  venueId: null,
});

export function groupProblem(v: GroupValues): string | null {
  if (v.season.trim().length < 4) return 'Escribe la temporada, por ejemplo 2026.';
  return null;
}

/** El nombre completo del grupo: "Sub-12 masculino B". */
export const groupNameFor = (category: string, v: GroupValues) => groupTeamName(category, v.group);

export function GroupFields({
  value,
  onChange,
  sameGender,
  venues,
}: {
  value: GroupValues;
  onChange: (value: GroupValues) => void;
  /** Cuántos grupos de ese género tiene ya la categoría (para sugerir la letra). */
  sameGender: (gender: CategoryGender) => number;
  /** Las sedes de la escuela; sin ellas no se pregunta. */
  venues?: readonly { id: string; name: string }[];
}) {
  const ids = { group: useId(), season: useId(), venue: useId(), hint: useId() };
  const set = (patch: Partial<GroupValues>) => onChange({ ...value, ...patch });
  const taken = sameGender(value.gender);
  return (
    <>
      <span className={styles.label}>Género</span>
      <Segmented
        label="Género"
        options={[
          { value: 'male', label: 'Masculino' },
          { value: 'female', label: 'Femenino' },
          { value: 'mixed', label: 'Mixto' },
        ]}
        value={value.gender}
        onChange={(gender) =>
          set({
            gender,
            group: value.groupTouched ? value.group : suggestGroupName(gender, sameGender(gender)),
          })
        }
      />
      <label htmlFor={ids.group} className={styles.label}>
        Nombre del grupo <span className={styles.optional}>(opcional)</span>
      </label>
      <input
        id={ids.group}
        className={styles.input}
        value={value.group}
        maxLength={30}
        autoComplete="off"
        placeholder="Ej.: Avanzados"
        aria-describedby={ids.hint}
        onChange={(event) => set({ group: event.target.value, groupTouched: true })}
      />
      <p id={ids.hint} className={styles.hint}>
        {taken > 0
          ? 'Ya hay un grupo de ese género en la categoría: te sugerimos la letra siguiente.'
          : 'Sale del género; cámbialo si en tu escuela le dicen distinto (Avanzados, Iniciación…).'}
      </p>
      <span className={styles.label}>Formato</span>
      <Segmented
        label="Formato"
        options={[
          { value: 'F5', label: 'Fútbol 5' },
          { value: 'F8', label: 'Fútbol 8' },
          { value: 'F11', label: 'Fútbol 11' },
        ]}
        value={value.format}
        onChange={(format) => set({ format })}
      />
      {venues && venues.length > 0 && (
        <>
          <label htmlFor={ids.venue} className={styles.label}>
            Sede
          </label>
          <select
            id={ids.venue}
            className={styles.input}
            value={value.venueId ?? ''}
            onChange={(event) => set({ venueId: event.target.value || null })}
          >
            <option value="">Sin sede</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={ids.season} className={styles.label}>
        Temporada
      </label>
      <input
        id={ids.season}
        className={styles.input}
        value={value.season}
        maxLength={9}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => set({ season: event.target.value })}
      />
    </>
  );
}
