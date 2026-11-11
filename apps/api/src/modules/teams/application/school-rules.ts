import type { BirthYears, CategoryGender, ClubKind } from '@sdl/contracts';
import { categoryConflict, formatBirthYears } from '@sdl/domain';

import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import type { TeamsRepository } from './ports/teams.repository.js';

/**
 * Escuelas (2026-11-07, 08 §10): la escuela es un club de tipo escuela y sus equipos son
 * categorías, cada una con sus años de nacimiento. Los años y las sedes son solo de escuelas.
 */

/** Equipos activos por club: 3 en un club de barrio (2026-10-29), 30 categorías (o grupos) en una escuela, Kevin 2026-11-07. */
export const TEAMS_PER_CLUB = 3;
export const CATEGORIES_PER_SCHOOL = 30;

export function teamsLimit(kind: ClubKind): number {
  return kind === 'school' ? CATEGORIES_PER_SCHOOL : TEAMS_PER_CLUB;
}

/**
 * Una categoría de escuela nace con sus años de nacimiento y su género (masculina, femenina o
 * mixta); un equipo de barrio, sin ellos.
 */
export function assertCategory(
  kind: ClubKind,
  category: {
    category?: string | null | undefined;
    birthYears?: BirthYears | undefined;
    gender?: CategoryGender | undefined;
  },
): void {
  if (kind === 'club') {
    if (category.birthYears || category.gender) assertSchool(kind);
    return;
  }
  if (!category.category) throw categoryRequired();
  if (!category.birthYears) {
    throw new BusinessRuleError(
      'Indica los años de nacimiento de la categoría',
      'BIRTH_YEARS_REQUIRED',
    );
  }
  if (!category.gender) {
    throw new BusinessRuleError(
      'Indica si la categoría es masculina, femenina o mixta',
      'CATEGORY_GENDER_REQUIRED',
    );
  }
}

/** Años de nacimiento y sedes, solo en escuelas. */
export function assertSchool(kind: ClubKind): void {
  if (kind !== 'school') {
    throw new BusinessRuleError('Esto es solo para escuelas', 'SCHOOL_ONLY');
  }
}

/** La sede tiene que ser de ese club (2026-11-07). */
export async function assertVenueOfClub(teams: TeamsRepository, clubId: string, venueId: string) {
  const venue = await teams.findVenue(venueId);
  if (!venue || venue.clubId !== clubId) {
    throw new NotFoundError('Esa sede no es de la escuela', 'VENUE_NOT_FOUND');
  }
}

function categoryRequired(): BusinessRuleError {
  return new BusinessRuleError(
    'Indica la categoría del grupo (por ejemplo, Sub-12)',
    'CATEGORY_REQUIRED',
  );
}

/**
 * Las categorías de una escuela no se cruzan de años (Kevin, 2026-11-07): un grupo nuevo va en
 * una categoría que ya existe, con sus mismos años, o en una nueva con años libres.
 */
export async function assertNoCategoryConflict(
  teams: TeamsRepository,
  clubId: string,
  candidate: { category: string | null; years: BirthYears | null },
  exceptTeamId?: string,
): Promise<void> {
  if (!candidate.category) throw categoryRequired();
  if (!candidate.years) {
    throw new BusinessRuleError(
      'Indica los años de nacimiento de la categoría',
      'BIRTH_YEARS_REQUIRED',
    );
  }
  const existing = (await teams.schoolCategories(clubId)).filter((c) => c.teamId !== exceptTeamId);
  const conflict = categoryConflict(existing, {
    category: candidate.category,
    years: candidate.years,
  });
  if (!conflict) return;
  const other = `${conflict.with.category} (${formatBirthYears(conflict.with.years)})`;
  const messages = {
    overlap: [`Esos años se cruzan con ${other}.`, 'CATEGORY_YEARS_OVERLAP'],
    'years-mismatch': [
      `${other} ya existe con esos años: un grupo nuevo de esa categoría lleva los mismos.`,
      'CATEGORY_YEARS_MISMATCH',
    ],
    'name-mismatch': [
      `Esos años ya son de ${other}: elige esa categoría.`,
      'CATEGORY_NAME_MISMATCH',
    ],
  } as const;
  const [message, code] = messages[conflict.kind];
  throw new ConflictError(message, code);
}
