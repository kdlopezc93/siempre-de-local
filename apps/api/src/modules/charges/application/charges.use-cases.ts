import { Inject, Injectable } from '@nestjs/common';
import type {
  ChargeListResponse,
  ChargeResponse,
  ChargeSummary,
  ChargesReminderResponse,
  CreateChargeRequest,
  MyChargesResponse,
  MyPaymentRequest,
  Payment,
  PaymentRequest,
  ShareRequest,
  SponsorRequest,
  UpdateChargeRequest,
} from '@sdl/contracts';
import {
  CHARGE_KIND_LABELS,
  chargeBalance,
  dueStage,
  localDay,
  chargeProblem,
  payable,
  shareAmount,
  shareStatus,
  sponsorProblem,
  whoOwes,
} from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
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
  // Lo que asumió el equipo no se le cobra a nadie: sale del saldo y se cuenta aparte.
  const owed = shares.filter((s) => !s.teamCovers);
  const rows = owed.map((s) => ({ amount: s.amount, paid: paid.get(s.userId)?.confirmed ?? 0 }));
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
    paidPeople:
      rows.filter((r) => shareStatus(r.amount, r.paid) === 'paid').length +
      (shares.length - owed.length),
    reported: payments.filter((p) => p.status === 'reported').length,
    teamCovered: shares.filter((s) => s.teamCovers).reduce((sum, s) => sum + s.amount, 0),
  };
}

/** La suma de los saldos de varios cobros, con lo que puso el equipo. */
const teamBalance = (items: ChargeSummary[]) => ({
  billed: items.reduce((sum, c) => sum + c.balance.billed, 0),
  collected: items.reduce((sum, c) => sum + c.balance.collected, 0),
  pending: items.reduce((sum, c) => sum + c.balance.pending, 0),
  teamCovered: items.reduce((sum, c) => sum + c.teamCovered, 0),
});

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
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  async list(actor: Actor, teamId: string): Promise<ChargeListResponse> {
    await this.authorize(actor, teamId, 'team.charges.read');
    const { records, sharesOf, paymentsOf } = await this.load(teamId);
    const items = records.map((c) =>
      toSummary(c, sharesOf.get(c.id) ?? [], paymentsOf.get(c.id) ?? []),
    );
    // El saldo del equipo y el de cada torneo, sin los anulados.
    const live = items.filter((c) => !c.cancelled);
    const tournaments = new Map<string, { name: string; items: ChargeSummary[] }>();
    for (const [i, c] of items.entries()) {
      const t = records[i]!.tournament ?? records[i]!.matchTournament;
      if (c.cancelled || !t) continue;
      const group = tournaments.get(t.id) ?? { name: t.name, items: [] };
      group.items.push(c);
      tournaments.set(t.id, group);
    }
    const debts = this.debts(records, sharesOf, paymentsOf);
    const [players, profiles] = await Promise.all([
      this.players.activePlayers(teamId),
      this.profiles.profilesOf(debts.map((d) => ({ id: d.userId, name: d.name }))),
    ]);
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    return {
      items,
      balance: teamBalance(live),
      byTournament: [...tournaments].map(([id, group]) => ({
        tournament: { id, name: group.name },
        balance: teamBalance(group.items),
        charges: group.items.length,
      })),
      debtors: debts.map((d) => ({
        userId: d.userId,
        displayName: profiles.get(d.userId)?.displayName ?? d.name,
        jerseyNumber: jersey.get(d.userId) ?? null,
        owed: d.owed,
        parts: d.parts,
      })),
    };
  }

  /** "Recordar a los que deben": un aviso a cada uno que debe algo, sin el valor (2026-10-31). */
  async remind(actor: Actor, teamId: string): Promise<ChargesReminderResponse> {
    const team = await this.authorize(actor, teamId, 'team.charges.write');
    const { records, sharesOf, paymentsOf } = await this.load(teamId);
    const debtors = this.debts(records, sharesOf, paymentsOf).map((d) => d.userId);
    await this.notifier.notifyUsers(debtors, {
      kind: 'charges-reminder',
      team: team.name,
      opponent: team.name,
      url: `/equipos/${teamId}/mis-cuentas`,
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'charges.reminder_sent',
      entity: 'team',
      entityId: teamId,
      teamId,
      meta: { people: debtors.length },
    });
    return { reminded: debtors.length };
  }

  /**
   * Recordatorio automático (2026-10-31, Kevin): lo corre una tarea diaria. A los que deben su
   * parte en un cobro que vence mañana u hoy, un aviso sin el valor; cada uno una sola vez por
   * fecha y etapa (`dueReminder`).
   */
  async remindDue(now = new Date()): Promise<{ charges: number; reminded: number }> {
    const days = [localDay(now), localDay(new Date(now.getTime() + 86_400_000))];
    const due = (await this.charges.dueOn(days)).flatMap((c) => {
      const stage = dueStage(c.dueOn, now);
      const key = `${c.dueOn}:${stage}`;
      return stage && c.dueReminder !== key ? [{ c, stage, key }] : [];
    });
    const ids = due.map(({ c }) => c.id);
    const [shares, payments] = await Promise.all([
      this.charges.shares(ids),
      this.charges.payments(ids),
    ]);
    const sharesOf = groupBy(shares);
    const paymentsOf = groupBy(payments);
    let reminded = 0;
    for (const { c, stage, key } of due) {
      const debtors = this.debts([c], sharesOf, paymentsOf).map((d) => d.userId);
      const what = c.title ?? CHARGE_KIND_LABELS[c.kind];
      await this.notifier.notifyUsers(debtors, {
        kind: 'charge-due',
        charge: what,
        when: stage,
        opponent: what,
        url: `/equipos/${c.teamId}/mis-cuentas`,
      });
      await this.charges.markDueReminder(c.id, key);
      reminded += debtors.length;
    }
    return { charges: due.length, reminded };
  }

  /** Los cobros del equipo con lo de cada uno y los pagos, agrupados por cobro. */
  private async load(teamId: string) {
    const records = await this.charges.list(teamId);
    const ids = records.map((c) => c.id);
    const [shares, payments] = await Promise.all([
      this.charges.shares(ids),
      this.charges.payments(ids),
    ]);
    return { records, sharesOf: groupBy(shares), paymentsOf: groupBy(payments) };
  }

  /** Quién debe cuánto en los cobros vigentes, con su nombre (`whoOwes`). */
  private debts(
    records: ChargeRecord[],
    sharesOf: Map<string, ShareRecord[]>,
    paymentsOf: Map<string, PaymentRecord[]>,
  ) {
    const names = new Map<string, string>();
    const rows = records
      .filter((c) => !c.cancelledAt)
      .flatMap((c) => {
        const paid = paidBy(paymentsOf.get(c.id) ?? []);
        return (sharesOf.get(c.id) ?? []).map((s) => {
          names.set(s.userId, s.name);
          if (s.sponsor) names.set(s.sponsor.id, s.sponsor.name);
          return {
            userId: s.userId,
            sponsorId: s.sponsor?.id ?? null,
            teamCovers: s.teamCovers,
            amount: s.amount,
            paid: paid.get(s.userId)?.confirmed ?? 0,
          };
        });
      });
    return whoOwes(rows).map((d) => ({ ...d, name: names.get(d.userId) ?? '' }));
  }

  async get(actor: Actor, teamId: string, chargeId: string): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.read');
    const record = await this.findOr404(teamId, chargeId);
    const [shares, payments, players] = await Promise.all([
      this.charges.shares([chargeId]),
      this.charges.payments([chargeId]),
      this.players.activePlayers(teamId),
    ]);
    const profiles = await this.profiles.profilesOf([
      ...shares.map((s) => ({ id: s.userId, name: s.name })),
      ...shares.flatMap((s) => (s.sponsor ? [s.sponsor] : [])),
    ]);
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
            status: s.teamCovers ? ('covered' as const) : shareStatus(s.amount, confirmed),
            sponsor: s.teamCovers
              ? { kind: 'team' as const }
              : s.sponsor
                ? {
                    kind: 'member' as const,
                    userId: s.sponsor.id,
                    displayName: profiles.get(s.sponsor.id)?.displayName ?? s.sponsor.name,
                  }
                : null,
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
    const sponsorOf = await this.initialSponsors(teamId, playerIds, request.sponsors ?? []);
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
      playerIds.map((userId) => {
        const sponsor = sponsorOf.get(userId) ?? null;
        return {
          userId,
          amount: each,
          sponsorId: sponsor !== 'team' ? sponsor : null,
          teamCovers: sponsor === 'team',
        };
      }),
    );
    await this.record(actor, teamId, chargeId, 'charge.created', {
      kind: request.kind,
      split: request.split,
      amount: request.amount,
      people: playerIds.length,
      sponsors: Object.fromEntries(sponsorOf),
    });
    // A cada uno le llega el aviso (2026-10-30, Kevin), menos a quien lo creó; sin el valor. Al
    // que le cubrieron la parte, "Te cubrieron tu parte"; a quien la asumió, que la asumió.
    const what = request.title ?? CHARGE_KIND_LABELS[request.kind];
    const url = `/equipos/${teamId}/mis-cuentas`;
    const notMe = (id: string) => id !== actor.userId;
    const message = { charge: what, opponent: what, url };
    await this.notifier.notifyUsers(
      playerIds.filter((id) => notMe(id) && !sponsorOf.has(id)),
      { kind: 'charge-created', ...message },
    );
    const covered = playerIds.filter((id) => notMe(id) && sponsorOf.has(id));
    if (covered.length > 0) {
      await this.notifier.notifyUsers(covered, { kind: 'charge-covered', ...message });
    }
    const sponsors = [...new Set(sponsorOf.values())].filter((id) => id !== 'team' && notMe(id));
    if (sponsors.length > 0) {
      await this.notifier.notifyUsers(sponsors, { kind: 'charge-sponsor', ...message });
    }
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

  /**
   * Patrocinio (2026-10-31): la parte entera de alguien la asume otro jugador del equipo, que la
   * paga, o el equipo; `null` se la devuelve. Solo mientras esa parte no tenga pagos.
   */
  async sponsor(
    actor: Actor,
    teamId: string,
    chargeId: string,
    userId: string,
    request: SponsorRequest,
  ): Promise<ChargeResponse> {
    await this.authorize(actor, teamId, 'team.charges.write');
    const record = await this.findOr404(teamId, chargeId);
    this.requireLive(record);
    const [shares, payments] = await Promise.all([
      this.charges.shares([chargeId]),
      this.charges.payments([chargeId]),
    ]);
    const share = shares.find((s) => s.userId === userId);
    if (!share) throw new BusinessRuleError('No está en este cobro.', 'NOT_IN_CHARGE');
    const before = share.teamCovers ? 'team' : (share.sponsor?.id ?? null);
    if (request.sponsor === before) return this.get(actor, teamId, chargeId);
    const { confirmed, reported } = paidBy(payments).get(userId) ?? { confirmed: 0, reported: 0 };
    const problem = sponsorProblem({ self: request.sponsor === userId, confirmed, reported });
    if (problem) throw new BusinessRuleError(problem, 'SPONSOR_NOT_ALLOWED');
    const member = request.sponsor !== null && request.sponsor !== 'team' ? request.sponsor : null;
    // Patrocina un jugador del equipo: es quien ve y paga la parte en Tus cuentas.
    if (member) await this.requirePlayers(teamId, [member]);
    await this.charges.setSponsor(chargeId, userId, {
      sponsorId: member,
      teamCovers: request.sponsor === 'team',
    });
    await this.record(actor, teamId, chargeId, 'charge.sponsor_set', {
      userId,
      sponsor: request.sponsor,
      before,
    });
    // Sin el valor ni quién: a quien le cubrieron la parte, y a quien la asumió.
    const what = record.title ?? CHARGE_KIND_LABELS[record.kind];
    const url = `/equipos/${teamId}/mis-cuentas`;
    if (before === null && userId !== actor.userId) {
      await this.notifier.notifyUsers([userId], {
        kind: 'charge-covered',
        charge: what,
        opponent: what,
        url,
      });
    }
    if (member && member !== actor.userId) {
      await this.notifier.notifyUsers([member], {
        kind: 'charge-sponsor',
        charge: what,
        opponent: what,
        url,
      });
    }
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

  /**
   * "Ya pagué": el jugador reporta su pago (o un abono) y espera que lo confirmen. Con
   * `forUserId`, el de la parte de un compañero que patrocina.
   */
  async reportPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    { forUserId, ...request }: MyPaymentRequest,
    now = new Date(),
  ): Promise<MyChargesResponse> {
    await this.authorize(actor, teamId, 'team.read');
    await this.addPayment(
      actor,
      teamId,
      chargeId,
      { ...request, userId: forUserId ?? actor.userId },
      'reported',
      now,
      (share) => {
        if (forUserId) {
          if (share.sponsor?.id !== actor.userId) {
            throw new ForbiddenError('Esa parte no la patrocinas tú.');
          }
        } else if (share.sponsor || share.teamCovers) {
          throw new BusinessRuleError('Tu parte ya te la cubrieron.', 'SHARE_COVERED');
        }
      },
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
    // La suya y las de los compañeros que patrocina; las de los demás, nada.
    const sharesOf = groupBy(
      shares.filter((s) => s.userId === actor.userId || s.sponsor?.id === actor.userId),
    );
    const sponsored = shares.filter((s) => s.sponsor?.id === actor.userId);
    const profiles = await this.profiles.profilesOf(
      sponsored.map((s) => ({ id: s.userId, name: s.name })),
    );
    let owed = 0;
    const items = records.flatMap((c) =>
      (sharesOf.get(c.id) ?? [])
        // Primero la suya, después las que patrocina.
        .sort((a, b) => Number(a.userId !== actor.userId) - Number(b.userId !== actor.userId))
        .map((share) => {
          const forPlayer =
            share.userId === actor.userId
              ? null
              : {
                  userId: share.userId,
                  displayName: profiles.get(share.userId)?.displayName ?? share.name,
                };
          // Si se la cubrieron, la ve cubierta: sin quién ni lo que pagó el otro.
          const covered = !forPlayer && (share.teamCovers || share.sponsor !== null);
          const own = covered
            ? []
            : payments.filter((p) => p.chargeId === c.id && p.userId === share.userId);
          const { confirmed, reported } = paidBy(own).get(share.userId) ?? {
            confirmed: 0,
            reported: 0,
          };
          if (!covered) owed += Math.max(share.amount - confirmed, 0);
          return this.myItem(c, share.amount, forPlayer, covered, own, confirmed, reported);
        }),
    );
    return { items, owed };
  }

  private myItem(
    c: ChargeRecord,
    amount: number,
    forPlayer: MyChargesResponse['items'][number]['forPlayer'],
    covered: boolean,
    own: PaymentRecord[],
    confirmed: number,
    reported: number,
  ): MyChargesResponse['items'][number] {
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
      forPlayer,
      amount,
      paid: confirmed,
      reported,
      status: covered ? 'covered' : shareStatus(amount, confirmed),
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
  }

  private async addPayment(
    actor: Actor,
    teamId: string,
    chargeId: string,
    request: PaymentRequest,
    status: 'confirmed' | 'reported',
    now: Date,
    check?: (share: ShareRecord) => void,
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
    check?.(share);
    if (share.teamCovers) {
      throw new BusinessRuleError('Esa parte la cubre el equipo.', 'SHARE_COVERED');
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

  /** Los patrocinios al crear: de alguien del cobro, una vez, nunca a sí mismo, y de un jugador. */
  private async initialSponsors(
    teamId: string,
    playerIds: string[],
    sponsors: { userId: string; sponsor: string }[],
  ): Promise<Map<string, string>> {
    const sponsorOf = new Map<string, string>();
    for (const { userId, sponsor } of sponsors) {
      if (!playerIds.includes(userId)) {
        throw new BusinessRuleError('No está en este cobro.', 'NOT_IN_CHARGE');
      }
      const problem = sponsorProblem({ self: sponsor === userId, confirmed: 0, reported: 0 });
      if (problem || sponsorOf.has(userId)) {
        throw new BusinessRuleError(
          problem ?? 'Una parte la asume uno solo.',
          'SPONSOR_NOT_ALLOWED',
        );
      }
      sponsorOf.set(userId, sponsor);
    }
    const members = [...new Set(sponsorOf.values())].filter((id) => id !== 'team');
    if (members.length > 0) await this.requirePlayers(teamId, members);
    return sponsorOf;
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
