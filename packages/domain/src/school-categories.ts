/**
 * Categorías de una escuela (Kevin, 2026-11-07, `08` §10): cada categoría es un rango de años
 * de nacimiento y sus grupos (masculino, femenino, mixto, A/B…) comparten exactamente esos años.
 * Dos categorías de la misma escuela no se cruzan. `from: null` es una categoría abierta por
 * abajo: "2008 o antes" (mayores, 18+).
 */
export interface BirthYearRange {
  from: number | null;
  to: number;
}

export interface SchoolCategory {
  category: string;
  years: BirthYearRange;
}

export type CategoryConflict =
  /** Los años se cruzan con los de otra categoría. */
  | { kind: 'overlap'; with: SchoolCategory }
  /** Esa categoría ya existe con otros años. */
  | { kind: 'years-mismatch'; with: SchoolCategory }
  /** Esos mismos años ya son de otra categoría (con otro nombre). */
  | { kind: 'name-mismatch'; with: SchoolCategory };

/** El nombre sin tildes, mayúsculas ni espacios de más: "Sub 12" y "sub-12" no; "SUB-12" sí. */
export function categoryKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const sameYears = (a: BirthYearRange, b: BirthYearRange) => a.from === b.from && a.to === b.to;

export function yearsOverlap(a: BirthYearRange, b: BirthYearRange): boolean {
  const low = (r: BirthYearRange) => r.from ?? Number.NEGATIVE_INFINITY;
  return low(a) <= b.to && low(b) <= a.to;
}

/** El primer choque del grupo nuevo (o cambiado) con las categorías que ya tiene la escuela. */
export function categoryConflict(
  existing: readonly SchoolCategory[],
  candidate: SchoolCategory,
): CategoryConflict | null {
  const key = categoryKey(candidate.category);
  for (const other of existing) {
    const same = categoryKey(other.category) === key;
    if (same && !sameYears(other.years, candidate.years)) {
      return { kind: 'years-mismatch', with: other };
    }
    if (!same && sameYears(other.years, candidate.years)) {
      return { kind: 'name-mismatch', with: other };
    }
    if (!same && yearsOverlap(other.years, candidate.years)) {
      return { kind: 'overlap', with: other };
    }
  }
  return null;
}

/** "2014–2015", "2014" o "2008 o antes", para los mensajes. */
export function formatBirthYears(years: BirthYearRange): string {
  if (years.from === null) return `${years.to} o antes`;
  return years.from === years.to ? `${years.to}` : `${years.from}–${years.to}`;
}
