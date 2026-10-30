import type { ChargeKind, ChargeSplit, PaymentMethod, PaymentStatus } from '@sdl/contracts';

export interface ChargeRecord {
  id: string;
  teamId: string;
  kind: ChargeKind;
  title: string | null;
  match: { id: string; opponent: string | null; startsAt: Date } | null;
  tournament: { id: string; name: string } | null;
  split: ChargeSplit;
  amount: number;
  dueOn: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
}

export interface ShareRecord {
  chargeId: string;
  userId: string;
  name: string;
  amount: number;
  note: string | null;
}

export interface PaymentRecord {
  id: string;
  chargeId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  status: PaymentStatus;
  reportedBy: { id: string; name: string } | null;
  reviewedBy: { id: string; name: string } | null;
  createdAt: Date;
}

/** Lo que se guarda al crear un cobro (el partido y el torneo, por su id). */
export type ChargeData = Pick<ChargeRecord, 'kind' | 'title' | 'split' | 'amount' | 'dueOn'> & {
  matchId: string | null;
  tournamentId: string | null;
};

export interface ChargesRepository {
  /** El cobro y lo que debe cada uno, juntos. */
  create(
    teamId: string,
    createdBy: string,
    data: ChargeData,
    shares: { userId: string; amount: number }[],
  ): Promise<string>;
  /** Los del equipo, el más nuevo primero. */
  list(teamId: string): Promise<ChargeRecord[]>;
  find(teamId: string, chargeId: string): Promise<ChargeRecord | null>;
  update(
    chargeId: string,
    patch: Partial<Pick<ChargeRecord, 'title' | 'dueOn' | 'cancelledAt'>>,
  ): Promise<void>;
  shares(chargeIds: string[]): Promise<ShareRecord[]>;
  payments(chargeIds: string[]): Promise<PaymentRecord[]>;
  /** Crea o cambia lo que debe alguien en el cobro. */
  setShare(chargeId: string, userId: string, amount: number, note: string | null): Promise<void>;
  addPayment(input: {
    chargeId: string;
    userId: string;
    amount: number;
    method: PaymentMethod;
    paidOn: string;
    status: Exclude<PaymentStatus, 'rejected'>;
    reportedBy: string;
    reviewedBy: string | null;
    at: Date;
  }): Promise<string>;
  reviewPayment(
    paymentId: string,
    status: Exclude<PaymentStatus, 'reported'>,
    reviewedBy: string,
    at: Date,
  ): Promise<void>;
  /** Los cobros vigentes (no anulados) en los que alguien debe algo, el más nuevo primero. */
  chargesOf(teamId: string, userId: string): Promise<ChargeRecord[]>;
  /** Que el partido y el torneo sean del equipo. */
  matchInTeam(teamId: string, matchId: string): Promise<boolean>;
  tournamentInTeam(teamId: string, tournamentId: string): Promise<boolean>;
}

export const CHARGES_REPOSITORY = Symbol('CHARGES_REPOSITORY');
