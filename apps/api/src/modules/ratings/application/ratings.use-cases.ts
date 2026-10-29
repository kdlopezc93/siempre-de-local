import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateRatingRequestSchema,
  MyCardResponse,
  PlayerRating,
  RatingAttributesResponse,
} from '@sdl/contracts';
import {
  assertValidRating,
  InvalidRatingError,
  positionAverages,
  RATING_ANCHORS,
  RATING_ATTRIBUTE_CODES,
  RATING_ATTRIBUTES,
  RATING_FORMULA_VERSION,
  type RatingValues,
} from '@sdl/domain';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import {
  can,
  cannotRateMessage,
  canRate,
  type Actor,
  type TeamPermission,
} from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  TEAMS_REPOSITORY,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  RATINGS_REPOSITORY,
  type RatingsRepository,
  type StoredRating,
} from './ports/ratings.repository.js';

/** La foto con sus medias por posición, calculadas con la fórmula vigente (no se guardan). */
export function toPlayerRating(rating: StoredRating): PlayerRating {
  return {
    ...rating,
    ratedAt: rating.ratedAt.toISOString(),
    values: { ...rating.values },
    positionAverages: positionAverages(rating.values),
    formulaVersion: RATING_FORMULA_VERSION,
  };
}

export function ratingCatalog(): RatingAttributesResponse {
  return {
    attributes: RATING_ATTRIBUTE_CODES.map((code) => ({ code, ...RATING_ATTRIBUTES[code] })),
    anchors: [...RATING_ANCHORS],
    formulaVersion: RATING_FORMULA_VERSION,
  };
}

@Injectable()
export class PlayerRatings {
  constructor(
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async create(
    actor: Actor,
    teamId: string,
    playerId: string,
    request: z.output<typeof CreateRatingRequestSchema>,
  ): Promise<PlayerRating> {
    await this.authorize(actor, teamId, 'team.ratings.write');
    const roles = await this.assertPlayer(teamId, playerId);
    const target = { userId: playerId, roles };
    if (!canRate(actor, teamId, target)) {
      throw new ForbiddenError(cannotRateMessage(actor, target.userId), 'CANNOT_RATE_PLAYER');
    }
    // Los de portero que no vinieron no se guardan.
    const values = Object.fromEntries(
      Object.entries(request.values).filter(([, value]) => value !== undefined),
    ) as RatingValues;
    try {
      assertValidRating(values);
    } catch (error) {
      if (error instanceof InvalidRatingError) {
        throw new BusinessRuleError(error.message, 'RATING_INVALID');
      }
      throw error;
    }
    if (request.position && positionAverages(values)[request.position] === undefined) {
      throw new BusinessRuleError(
        'Para ponerle portero, puntúa también sus atributos de portero',
        'RATING_POSITION_WITHOUT_AVERAGE',
      );
    }
    const saved = await this.ratings.create({
      teamId,
      playerUserId: playerId,
      ratedBy: actor.userId,
      values,
      notes: request.notes || null,
      position: request.position ?? null,
    });
    // Datos evaluativos (04 §3): cada foto nueva queda registrada.
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'rating.created',
      entity: 'player_rating',
      entityId: saved.id,
      teamId,
      meta: { playerId },
    });
    return toPlayerRating(saved);
  }

  async history(actor: Actor, teamId: string, playerId: string): Promise<PlayerRating[]> {
    await this.authorize(actor, teamId, 'team.results.read');
    await this.assertPlayer(teamId, playerId);
    return (await this.ratings.listByPlayer(teamId, playerId)).map(toPlayerRating);
  }

  private async assertPlayer(teamId: string, playerId: string) {
    const player = await this.memberships.loadMemberships(playerId);
    const roles = player.teams.get(teamId) ?? [];
    if (!roles.includes('player')) {
      throw new NotFoundError('Ese jugador no está en el equipo', 'PLAYER_NOT_IN_TEAM');
    }
    return roles;
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
  }
}

@Injectable()
export class MyCard {
  constructor(
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
  ) {}

  /** Su tarjeta en ese equipo, si el equipo la hace visible (D8). Sin notas ni autor. */
  async get(userId: string, teamId: string): Promise<MyCardResponse> {
    const team = await this.teams.findById(teamId);
    const mine = await this.memberships.loadMemberships(userId);
    if (!team || !mine.teams.get(teamId)?.includes('player')) {
      throw new NotFoundError('No juegas en ese equipo', 'PLAYER_NOT_IN_TEAM');
    }
    if (!team.ratingsVisibleToPlayers) {
      throw new ForbiddenError('Tu equipo no muestra la tarjeta a los jugadores.', 'CARD_HIDDEN');
    }
    const [latest] = await this.ratings.listByPlayer(teamId, userId);
    if (!latest) return { card: null };
    const { ratedAt, position, values, positionAverages, formulaVersion } = toPlayerRating(latest);
    return { card: { ratedAt, position, values, positionAverages, formulaVersion } };
  }
}
