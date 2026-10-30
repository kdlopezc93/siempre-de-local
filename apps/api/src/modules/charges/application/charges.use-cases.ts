import { Inject, Injectable } from '@nestjs/common';
import type {
  ChargeListResponse,
  ChargeResponse,
  ChargeSummary,
  CreateChargeRequest,
  MyChargesResponse,
  MyPaymentRequest,
  Payment,
  PaymentRequest,
  ShareRequest,
  UpdateChargeRequest,
} from '@sdl/contracts';
import { chargeBalance, chargeProblem, payable, shareAmount, shareStatus } from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from '../../squad/application/ports/squad.ports.js';
import {
  TEAMS_REPOSITORY,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  CHARGES_REPOSITORY,
  type ChargeRecord,
  type ChargesRepository,
  type PaymentRecord,
  type ShareRecord,
} from './ports/charges.repository.js';

/** Lo que pagó cada uno en un cobro: confirmado y reportado (sin confirmar), por persona. */
function paidBy(payments: PaymentRecord[]) {
  const paid = new Map<string, { confirmed: number; reported: number }>();
  for (const p of payments) {
    const entry = paid.get(p.userId) ?? { confirmed: 0, reported: 0 };
    if (p.status === 'confirmed') entry.confirmed += p.amount;
    if (p.status === 'reported') entry.reported += p.amount;
    paid.set(p.userId, entry);
  }
  return paid;
}

const toPayment = (p: PaymentRecord): Payment => ({
  id: p.id,
  userId: p.userId,
  amount: p.amount,
  method: p.method,
  paidOn: p.paidOn,
  status: p.status,
  reportedBy: p.reportedBy,
  reviewedBy: p.reviewedBy,
  createdAt: p.createdAt.toISOString(),
});

function toSummary(
  c: ChargeRecord,
  shares: ShareRecord[],
  payments: PaymentRecord[],
): ChargeSummary {
  const paid = paidBy(payments);
  const rows = shares.map((s) => ({ amount: s.amount, paid: paid.get(s.userId)?.confirmed ?? 0 }));
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    match: c.match ? { ...c.match, startsAt: c.match.startsAt.toISOString() } : null,
    tournament: c.tournament,
    split: c.split,
    amount: c.amount,
    dueOn: c.dueOn,
    createdAt: c.createdAt.toISOString(),
    cancelled: c.cancelledAt !== null,
    balance: chargeBalance(rows),
    people: shares.length,
    paidPeople: rows.filter((r) => shareStatus(r.amount, r.paid) === 'paid').length,
    reported: payments.filter((p) => p.status === 'reported').length,
  };
}

const groupBy = <T extends { chargeId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.chargeId, [...(map.get(row.chargeId) ?? []), row]);
  return map;
};

/**
 * Cobros del equipo (`06` Cobros, `02` §15): el cuerpo técnico y el tesorero crean cobros, ajustan
 * lo de cada uno, registran pagos y confirman los "Ya pagué"; cada jugador ve lo suyo. La plata
 * se paga por fuera; aquí se lleva la cuenta. Todo queda en la auditoría.
 */
@Injectable()
export class Charges {
  constructor(
    @Inject(CHARGES_REPOSITORY) private readonly charges: ChargesRepository,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async list(actor: Actor, teamId: string): Promise<ChargeListResponse> {
    await this.authorize(actor, teamId, 'team.charges.read');
    const records = await this.charges.list(teamId);
    const ids = records.map((c) => c.id);
    const [shares, payments] = await Promise.all([
      this.charges.shares(ids),
      this.charges.payments(ids),
    ]);
    const sharesOf = groupBy(shares);
    const paymentsOf = groupBy(payments);
    const items = records.map((c) =>
      toSummary(c, sharesOf.get(c.id) ?? [], paymentsOf.get(c.id) ?? []),
    );
    // El saldo del equipo, sin los anulados.
    const live = items.filter((c) => !c.cancelled).map((c) => c.balance);
    return {
      items,
      balance: {
        billed: live.reduce((sum, b) => sum + b.billed, 0),
        collected: live.reduce((sum, b) => sum + b.collected, 0),
        pending: live.reduce((sum, b) => sum + b.pending, 0),
      },
    };
  }

  async get(actor: Actor, teamId: string, chargeId: string): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.read');
    const record = await this.findOr404(teamId, chargeId);
    const [shares, payments, players] = await Promise.all([
      this.charges.shares([chargeId]),
      this.charges.payments([chargeId]),
      this.players.activePlayers(teamId),
    ]);
    const profiles = await this.profiles.profilesOf(
      shares.map((s) => ({ id: s.userId, name: s.name })),
    );
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    const paid = paidBy(payments);
    return {
      charge: toSummary(record, shares, payments),
      shares: shares
        .map((s) => {
          const { confirmed, reported } = paid.get(s.userId) ?? { confirmed: 0, reported: 0 };
          return {
            userId: s.userId,
            displayName: profiles.get(s.userId)?.displayName ?? s.name,
            jerseyNumber: jersey.get(s.userId) ?? null,
            amount: s.amount,
            note: s.note,
            paid: confirmed,
            reported,
            status: shareStatus(s.amount, confirmed),
          };
        })
        .sort(
          (a, b) =>
            (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
            a.displayName.localeCompare(b.displayName, 'es'),
        ),
      payments: payments.map(toPayment),
    };
  }

  async create(
    actor: Actor,
    teamId: string,
    request: CreateChargeRequest,
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    const playerIds = [...new Set(request.playerIds)];
    const matchId = request.matchId ?? null;
    const tournamentId = request.tournamentId ?? null;
    const problem = chargeProblem({
      kind: request.kind,
      amount: request.amount,
      people: playerIds.length,
      matchId,
      tournamentId,
    });
    if (problem) throw new BusinessRuleError(problem, 'CHARGE_FIELDS');
    if (matchId && !(await this.charges.matchInTeam(teamId, matchId))) {
      throw new BusinessRuleError('Ese partido no es del equipo.', 'MATCH_NOT_FOUND');
    }
    if (tournamentId && !(await this.charges.tournamentInTeam(teamId, tournamentId))) {
      throw new BusinessRuleError('Ese torneo no es del equipo.', 'TOURNAMENT_NOT_FOUND');
    }
    await this.requirePlayers(teamId, playerIds);
    const each = shareAmount(request.split, request.amount, playerIds.length);
    const chargeId = await this.charges.create(
      teamId,
      actor.userId,
      {
        kind: request.kind,
        title: request.title ?? null,
        split: request.split,
        amount: request.amount,
        dueOn: request.dueOn ?? null,
        matchId,
        tournamentId,
      },
      playerIds.map((userId) => ({ userId, amount: each })),
    );
    await this.record(actor, teamId, chargeId, 'charge.created', {
      kind: request.kind,
      split: request.split,
      amount: request.amount,
      people: playerIds.length,
    });
    return this.get(actor, teamId, chargeId);
  }

  async update(
    actor: Actor,
    teamId: string,
    chargeId: string,
    patch: UpdateChargeRequest,
    now = new Date(),
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    const record = await this.findOr404(teamId, chargeId);
    this.requireLive(record);
    await this.charges.update(chargeId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.dueOn !== undefined ? { dueOn: patch.dueOn } : {}),
      ...(patch.cancelled ? { cancelledAt: now } : {}),
    });
    await this.record(
      actor,
      teamId,
      chargeId,
      patch.cancelled ? 'charge.cancelled' : 'charge.updated',
      {},
    );
    return this.get(actor, teamId, chargeId);
  }

  /** Ajustar lo que debe alguien, o sumarlo al cobro. No baja de lo que ya pagó. */
  async setShare(
    actor: Actor,
    teamId: string,
    chargeId: string,
    userId: string,
    request: ShareRequest,
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    const record = await this.findOr404(teamId, chargeId);
    this.requireLive(record);
    const [shares, payments] = await Promise.all([
      this.charges.shares([chargeId]),
      this.charges.payments([chargeId]),
    ]);
    const current = shares.find((s) => s.userId === userId);
    if (!current) await this.requirePlayers(teamId, [userId]);
    if (record.kind === 'fine' && !current) {
      throw new BusinessRuleError('Una multa es de una sola persona.', 'CHARGE_FIELDS');
    }
    const confirmed = paidBy(payments).get(userId)?.confirmed ?? 0;
    if (request.amount < confirmed) {
      throw new BusinessRuleError(
        'Ya pagó más que eso: no se le puede bajar de lo que pagó.',
        'SHARE_BELOW_PAID',
      );
    }
    await this.charges.setShare(chargeId, userId, request.amount, request.note ?? null);
    await this.record(actor, teamId, chargeId, 'charge.share_set', {
      userId,
      amount: request.amount,
      before: current?.amount ?? null,
    });
    return this.get(actor, teamId, chargeId);
  }

  /** El tesorero o el cuerpo técnico registran un pago o abono: queda confirmado. */
  async registerPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    request: PaymentRequest,
    now = new Date(),
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    await this.addPayment(actor, teamId, chargeId, request, 'confirmed', now);
    return this.get(actor, teamId, chargeId);
  }

  /** "Ya pagué": el jugador reporta su pago (o un abono) y espera que lo confirmen. */
  async reportPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    request: MyPaymentRequest,
    now = new Date(),
  ): Promise<MyChargesResponse> {
    await this.authorize(actor, teamId, 'team.read');
    await this.addPayment(
      actor,
      teamId,
      chargeId,
      { ...request, userId: actor.userId },
      'reported',
      now,
    );
    return this.mine(actor, teamId);
  }

  /** Confirmar o rechazar un "Ya pagué". */
  async reviewPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    paymentId: string,
    status: 'confirmed' | 'rejected',
    now = new Date(),
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    const record = await this.findOr404(teamId, chargeId);
    this.requireLive(record);
    const found = (await this.charges.payments([chargeId])).find((p) => p.id === paymentId);
    if (!found) throw new NotFoundError('Pago no encontrado', 'PAYMENT_NOT_FOUND');
    if (found.status !== 'reported') {
      throw new ConflictError('Ese pago ya fue revisado.', 'PAYMENT_REVIEWED');
    }
    await this.charges.reviewPayment(paymentId, status, actor.userId, now);
    await this.record(actor, teamId, chargeId, `payment.${status}`, {
      paymentId,
      userId: found.userId,
      amount: found.amount,
    });
    return this.get(actor, teamId, chargeId);
  }

  /** Lo que debe y pagó quien pregunta en los cobros vigentes: lo suyo, nada de los demás. */
  async mine(actor: Actor, teamId: string): Promise<MyChargesResponse> {
    await this.authorize(actor, teamId, 'team.read');
    const records = await this.charges.chargesOf(teamId, actor.userId);
    const ids = records.map((c) => c.id);
    const [shares, payments] = await Promise.all([
      this.charges.shares(ids),
      this.charges.payments(ids),
    ]);
    const mine = new Map(
      shares.filter((s) => s.userId === actor.userId).map((s) => [s.chargeId, s]),
    );
    const myPayments = groupBy(payments.filter((p) => p.userId === actor.userId));
    let owed = 0;
    const items = records.map((c) => {
      const share = mine.get(c.id)!;
      const own = myPayments.get(c.id) ?? [];
      const { confirmed, reported } = paidBy(own).get(actor.userId) ?? {
        confirmed: 0,
        reported: 0,
      };
      owed += Math.max(share.amount - confirmed, 0);
      const summary = toSummary(c, [], []);
      return {
        charge: {
          id: summary.id,
          kind: summary.kind,
          title: summary.title,
          match: summary.match,
          tournament: summary.tournament,
          dueOn: summary.dueOn,
          createdAt: summary.createdAt,
        },
        amount: share.amount,
        paid: confirmed,
        reported,
        status: shareStatus(share.amount, confirmed),
        payments: own.map((p) => ({
          id: p.id,
          userId: p.userId,
          amount: p.amount,
          method: p.method,
          paidOn: p.paidOn,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    });
    return { items, owed };
  }

  private async addPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    request: PaymentRequest,
    status: 'confirmed' | 'reported',
    now: Date,
  ) {
    const record = await this.findOr404(teamId, chargeId);
    this.requireLive(record);
    const [shares, payments] = await Promise.all([
      this.charges.shares([chargeId]),
      this.charges.payments([chargeId]),
    ]);
    const share = shares.find((s) => s.userId === request.userId);
    if (!share) {
      throw new BusinessRuleError('No está en este cobro.', 'NOT_IN_CHARGE');
    }
    const { confirmed, reported } = paidBy(payments).get(request.userId) ?? {
      confirmed: 0,
      reported: 0,
    };
    const left = payable(share.amount, confirmed, reported);
    if (request.amount > left) {
      throw new BusinessRuleError(
        left === 0
          ? 'Ya no falta nada por pagar (o está esperando que confirmen un pago).'
          : `Eso es más de lo que falta: $${left.toLocaleString('es-CO')}.`,
        'PAYMENT_TOO_HIGH',
      );
    }
    const paymentId = await this.charges.addPayment({
      chargeId,
      userId: request.userId,
      amount: request.amount,
      method: request.method,
      paidOn: request.paidOn,
      status,
      reportedBy: actor.userId,
      reviewedBy: status === 'confirmed' ? actor.userId : null,
      at: now,
    });
    await this.record(actor, teamId, chargeId, `payment.${status}`, {
      paymentId,
      userId: request.userId,
      amount: request.amount,
      method: request.method,
    });
  }

  private async requirePlayers(teamId: string, playerIds: string[]) {
    const active = new Set((await this.players.activePlayers(teamId)).map((p) => p.userId));
    if (playerIds.some((id) => !active.has(id))) {
      throw new BusinessRuleError('No es jugador de este equipo.', 'PLAYER_NOT_IN_TEAM');
    }
  }

  private requireLive(record: ChargeRecord) {
    if (record.cancelledAt) throw new ConflictError('El cobro fue anulado.', 'CHARGE_CANCELLED');
  }

  private async findOr404(teamId: string, chargeId: string) {
    const record = await this.charges.find(teamId, chargeId);
    if (!record) throw new NotFoundError('Cobro no encontrado', 'CHARGE_NOT_FOUND');
    return record;
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    return team;
  }

  private record(
    actor: Actor,
    teamId: string,
    chargeId: string,
    action: string,
    meta: Record<string, unknown>,
  ) {
    return this.audit.record({
      actorUserId: actor.userId,
      action,
      entity: 'charge',
      entityId: chargeId,
      teamId,
      meta,
    });
  }
}
