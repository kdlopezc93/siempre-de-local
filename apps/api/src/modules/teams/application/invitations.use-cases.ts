import { Inject, Injectable } from '@nestjs/common';
import type {
  AcceptInvitationResponse,
  CreateInvitationRequestSchema,
  InvitationPreviewResponse,
  InvitationSummary,
  TeamRole,
} from '@sdl/contracts';
import type { z } from 'zod';

import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import { generateInvitationCode, hashInvitationCode } from './invitation-code.js';
import { invitationStatus } from './invitation-status.js';
import {
  INVITATIONS_REPOSITORY,
  type InvitationRecord,
  type InvitationsRepository,
} from './ports/invitations.repository.js';
import { OPEN_MATCHES_QUERY, type OpenMatchesQuery } from './ports/open-matches.query.js';
import { TEAMS_REPOSITORY, type TeamsRepository } from './ports/teams.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Invitar jugadores es del coach; invitar cuerpo técnico, del admin del club (04 §2.2). */
const permissionToInvite = (role: TeamRole): TeamPermission =>
  role === 'player' ? 'team.players.invite' : 'team.staff.invite';

const NOT_FOUND = () =>
  new NotFoundError('Esta invitación no existe. Revisa el enlace.', 'INVITATION_NOT_FOUND');

function toSummary(invitation: InvitationRecord, now: Date): InvitationSummary {
  return {
    id: invitation.id,
    role: invitation.role,
    status: invitationStatus(invitation, now),
    expiresAt: invitation.expiresAt.toISOString(),
    maxUses: invitation.maxUses,
    usedCount: invitation.usedCount,
    createdAt: invitation.createdAt.toISOString(),
  };
}

@Injectable()
export class TeamInvitations {
  constructor(
    @Inject(INVITATIONS_REPOSITORY) private readonly invitations: InvitationsRepository,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
  ) {}

  async create(
    actor: Actor,
    teamId: string,
    request: z.output<typeof CreateInvitationRequestSchema>,
    now = new Date(),
  ): Promise<{ invitation: InvitationSummary; code: string }> {
    await this.authorize(actor, teamId, permissionToInvite(request.role));
    const code = generateInvitationCode();
    const invitation = await this.invitations.create({
      teamId,
      role: request.role,
      codeHash: hashInvitationCode(code),
      createdBy: actor.userId,
      expiresAt: new Date(now.getTime() + request.expiresInDays * DAY_MS),
      maxUses: request.maxUses,
    });
    return { invitation: toSummary(invitation, now), code };
  }

  async list(actor: Actor, teamId: string, now = new Date()): Promise<InvitationSummary[]> {
    await this.authorize(actor, teamId, 'team.players.invite');
    const all = await this.invitations.listByTeam(teamId);
    // Quien solo puede invitar jugadores no ve las invitaciones de cuerpo técnico.
    const scope = await this.scope(teamId);
    return all
      .filter((inv) => can(actor, permissionToInvite(inv.role), scope))
      .map((inv) => toSummary(inv, now));
  }

  async revoke(actor: Actor, teamId: string, invitationId: string, now = new Date()) {
    const invitation = await this.invitations.findInTeam(teamId, invitationId);
    if (!invitation) throw NOT_FOUND();
    await this.authorize(actor, teamId, permissionToInvite(invitation.role));
    if (!invitation.revokedAt) await this.invitations.revoke(invitation.id, now);
  }

  private async scope(teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    return { teamId, clubId: team.club.id };
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    if (!can(actor, permission, await this.scope(teamId))) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
  }
}

@Injectable()
export class InvitationRedemption {
  constructor(
    @Inject(INVITATIONS_REPOSITORY) private readonly invitations: InvitationsRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
    @Inject(OPEN_MATCHES_QUERY) private readonly matches: OpenMatchesQuery,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  /** Público: lo que ve quien abre el enlace antes de entrar. */
  async preview(code: string, now = new Date()): Promise<InvitationPreviewResponse> {
    const invitation = await this.usable(code, now);
    return {
      team: { id: invitation.team.id, name: invitation.team.name, format: invitation.team.format },
      club: { name: invitation.team.clubName },
      role: invitation.role,
    };
  }

  async accept(userId: string, code: string, now = new Date()): Promise<AcceptInvitationResponse> {
    const invitation = await this.usable(code, now);
    // Ley 1581: sin autorización previa no entra al equipo (04 §1.2, paso 3).
    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError('Antes de unirte acepta la política de datos.', 'CONSENT_REQUIRED');
    }
    const outcome = await this.invitations.redeem(invitation, userId, now);
    if (outcome === 'unavailable') throw unusable('used_up');
    if (outcome !== 'already-member' && invitation.role === 'player') {
      await this.callToOpenMatches(invitation.teamId, userId, now);
    }
    return {
      teamId: invitation.teamId,
      role: invitation.role,
      alreadyMember: outcome === 'already-member',
    };
  }

  /**
   * El que entra tarde (2026-10-26): la convocatoria de los partidos que siguen abiertos, que
   * al crearse solo les llegó a los que ya estaban. Un aviso que falla no impide unirse.
   */
  private async callToOpenMatches(teamId: string, userId: string, now: Date) {
    for (const match of await this.matches.openMatches(teamId, now)) {
      await this.notifier.notifyUsers([userId], {
        kind: 'match-called',
        opponent: match.opponent,
        startsAt: match.startsAt.toISOString(),
        url: `/equipos/${teamId}/partidos/${match.id}`,
      });
    }
  }

  private async usable(code: string, now: Date) {
    const invitation = await this.invitations.findByCodeHash(hashInvitationCode(code));
    if (!invitation) throw NOT_FOUND();
    const status = invitationStatus(invitation, now);
    if (status !== 'active') throw unusable(status);
    return invitation;
  }
}

function unusable(status: 'expired' | 'used_up' | 'revoked'): BusinessRuleError {
  const messages = {
    expired: [
      'Esta invitación ya venció. Pídele un enlace nuevo a tu entrenador.',
      'INVITATION_EXPIRED',
    ],
    used_up: [
      'Esta invitación ya se usó todas las veces. Pídele otra a tu entrenador.',
      'INVITATION_USED_UP',
    ],
    revoked: [
      'Esta invitación fue anulada. Pídele un enlace nuevo a tu entrenador.',
      'INVITATION_REVOKED',
    ],
  } as const;
  const [message, code] = messages[status];
  return new BusinessRuleError(message, code);
}
