import type { BirthYears, CategoryGender, ClubKind } from '@sdl/contracts';

import { BusinessRuleError, NotFoundError } from '../../../shared/errors/application-errors.js';
import type { TeamsRepository } from './ports/teams.repository.js';

/**
 * Escuelas (2026-11-07, 08 §10): la escuela es un club de tipo escuela y sus equipos son
 * categorías, cada una con sus años de nacimiento. Los años y las sedes son solo de escuelas.
 */

/** Equipos activos por club: 3 en un club de barrio (2026-10-29), 12 categorías en una escuela. */
export const TEAMS_PER_CLUB = 3;
export const CATEGORIES_PER_SCHOOL = 12;

export function teamsLimit(kind: ClubKind): number {
  return kind === 'school' ? CATEGORIES_PER_SCHOOL : TEAMS_PER_CLUB;
}

/**
 * Una categoría de escuela nace con sus años de nacimiento y su género (masculina, femenina o
 * mixta); un equipo de barrio, sin ellos.
 */
export function assertCategory(
  kind: ClubKind,
  category: { birthYears?: BirthYears | undefined; gender?: CategoryGender | undefined },
): void {
  if (kind === 'club') {
    if (category.birthYears || category.gender) assertSchool(kind);
    return;
  }
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
