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

export type GroupGender = 'male' | 'female' | 'mixed';

export const GENDER_LABEL: Record<GroupGender, string> = {
  male: 'Masculino',
  female: 'Femenino',
  mixed: 'Mixto',
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * El nombre que se sugiere para un grupo nuevo de una categoría: "Masculino" si es el primero de
 * ese género; si ya hay, la letra siguiente ("Masculino B", "Masculino C"). Mixto, el primero
 * no lleva nombre (el grupo se llama como la categoría).
 */
export function suggestGroupName(gender: GroupGender, sameGenderGroups: number): string {
  const base = GENDER_LABEL[gender];
  if (sameGenderGroups === 0) return gender === 'mixed' ? '' : base;
  return `${base} ${LETTERS[Math.min(sameGenderGroups, LETTERS.length - 1)]}`;
}

/** El nombre completo del equipo: "Sub-12" + "Masculino B" → "Sub-12 masculino B". */
export function groupTeamName(category: string, group: string): string {
  const c = category.trim();
  const g = group.trim();
  return g ? `${c} ${g[0]!.toLowerCase()}${g.slice(1)}` : c;
}

/** El nombre del grupo dentro de su categoría: "Sub-12 masculino B" → "Masculino B". */
export function groupLabel(teamName: string, category: string, gender: GroupGender | null) {
  const name = teamName.trim();
  const prefix = category.trim();
  const rest =
    prefix && categoryKey(name).startsWith(categoryKey(prefix))
      ? name.slice(prefix.length).trim()
      : name;
  if (!rest) return gender ? GENDER_LABEL[gender] : name;
  return rest[0]!.toUpperCase() + rest.slice(1);
}

/** "Este año tienen 11 y 12 años", para quien llena los años. */
export function agesHint(years: BirthYearRange, currentYear: number): string {
  const oldest = years.from === null ? null : currentYear - years.from;
  const youngest = currentYear - years.to;
  if (oldest === null) return `Este año tienen ${youngest} años o más.`;
  if (oldest === youngest) return `Este año tienen ${youngest} años.`;
  return `Este año tienen ${youngest} y ${oldest} años.`;
}

export interface CategoryWithGroups<T> {
  category: string;
  years: BirthYearRange;
  groups: T[];
}

/** Junta los grupos por categoría, de la mayor a la menor (Mayores, Sub-14, Sub-12…). */
export function groupByCategory<
  T extends { category: string | null; birthYears: BirthYearRange | null },
>(teams: readonly T[]): CategoryWithGroups<T>[] {
  const byKey = new Map<string, CategoryWithGroups<T>>();
  for (const team of teams) {
    if (!team.category || !team.birthYears) continue;
    const key = categoryKey(team.category);
    const entry = byKey.get(key) ?? {
      category: team.category,
      years: team.birthYears,
      groups: [],
    };
    entry.groups.push(team);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => a.years.to - b.years.to);
}

export type StripSegment =
  | { kind: 'category'; category: string; from: number | null; to: number; span: number }
  | { kind: 'gap'; from: number; to: number; span: number };

/**
 * La franja "Quiénes caben hoy": de la categoría más vieja a la más joven, una columna por año
 * (la abierta por abajo ocupa una) y los años sin categoría como huecos.
 */
export function yearStrip(categories: readonly { category: string; years: BirthYearRange }[]) {
  const sorted = [...categories].sort((a, b) => a.years.to - b.years.to);
  const segments: StripSegment[] = [];
  let next: number | null = null;
  for (const { category, years } of sorted) {
    const start = years.from ?? years.to;
    if (next !== null && start > next) {
      segments.push({ kind: 'gap', from: next, to: start - 1, span: start - next });
    }
    segments.push({
      kind: 'category',
      category,
      from: years.from,
      to: years.to,
      span: years.from === null ? 1 : years.to - years.from + 1,
    });
    next = years.to + 1;
  }
  return segments;
}

/** "Sub-12" para los nacidos desde 2014 en 2026 (la edad del mayor); "Mayores" si es abierta. */
export function suggestCategoryName(from: number | null, currentYear: number): string {
  return from === null ? 'Mayores' : `Sub-${currentYear - from}`;
}

/** Mayor de edad en Colombia: 18 años. Con el año basta (no se guarda la fecha). */
export const ADULT_AGE = 18;

/**
 * Quiénes caben en una categoría por sus años (escuelas, 2026-11-10): `minors` si alguno es menor
 * este año (entra con su acudiente) y `adults` si alguno ya es mayor (entra con su cuenta). Sin
 * años (un equipo de club), solo adultos.
 */
export function categoryAges(
  years: BirthYearRange | null,
  thisYear: number,
): { minors: boolean; adults: boolean } {
  if (!years) return { minors: false, adults: true };
  const lastAdultYear = thisYear - ADULT_AGE;
  return {
    minors: years.to > lastAdultYear,
    adults: years.from === null || years.from <= lastAdultYear,
  };
}

/** "tu hija", "tu hijo" o "tu hijo o hija", según el grupo. */
export function childWord(gender: GroupGender | null): string {
  return gender === 'female' ? 'tu hija' : gender === 'male' ? 'tu hijo' : 'tu hijo o hija';
}
