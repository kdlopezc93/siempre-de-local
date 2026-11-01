/**
 * Cobros del equipo (`06` Cobros, `02` §15): la vaca, la inscripción, el arbitraje, las multas…
 * La app lleva la cuenta de quién pagó; la plata se paga por fuera (efectivo, Nequi, Daviplata).
 * Todo en pesos enteros. Reglas puras.
 */
export type ChargeKind = 'registration' | 'referee' | 'vaca' | 'fee' | 'fine' | 'uniform' | 'other';

export const CHARGE_KIND_LABELS: Readonly<Record<ChargeKind, string>> = {
  registration: 'Inscripción',
  referee: 'Arbitraje',
  vaca: 'Vaca',
  fee: 'Cuota',
  fine: 'Multa',
  uniform: 'Uniforme',
  other: 'Otro',
};

/** Un valor por persona, o un total que se reparte entre los que se elijan. */
export type ChargeSplit = 'per_person' | 'total';

export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'transfer' | 'other';

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  transfer: 'Transferencia',
  other: 'Otro',
};

/** El "Ya pagué" del jugador queda reportado hasta que el tesorero lo confirme o lo rechace. */
export type PaymentStatus = 'reported' | 'confirmed' | 'rejected';

/** El tope de un cobro: cien millones de pesos (un error de dedo, no una inscripción). */
export const MAX_CHARGE_AMOUNT = 100_000_000;

/** Las partes de una vaca se redondean hacia arriba a los $100 siguientes (Kevin, 2026-10-30). */
export const SPLIT_ROUNDING = 100;

/**
 * Repartir un total entre `people`: cada parte sube a los $100 siguientes, como en una vaca, y lo
 * que sobra se muestra ("sobran $X"). Nunca falta plata.
 */
export function splitTotal(total: number, people: number): { share: number; surplus: number } {
  if (people <= 0) throw new RangeError('Hay que repartir entre al menos una persona.');
  const share = Math.ceil(total / people / SPLIT_ROUNDING) * SPLIT_ROUNDING;
  return { share, surplus: share * people - total };
}

/** Lo que le toca a cada uno al crear el cobro. */
export function shareAmount(split: ChargeSplit, amount: number, people: number): number {
  return split === 'per_person' ? amount : splitTotal(amount, people).share;
}

/**
 * Qué falta para crear el cobro, en palabras, o null si está bien. Una multa es de una sola
 * persona; un cobro de partido no es de un torneo (el torneo se ve por el partido).
 */
export function chargeProblem(input: {
  kind: ChargeKind;
  amount: number;
  people: number;
  matchId: string | null;
  tournamentId: string | null;
}): string | null {
  if (!Number.isInteger(input.amount) || input.amount < 1) return 'Pon cuánto es.';
  if (input.amount > MAX_CHARGE_AMOUNT) return 'Ese valor es demasiado alto.';
  if (input.people < 1) return 'Elige a quién se le cobra.';
  if (input.kind === 'fine' && input.people !== 1) return 'Una multa es de una sola persona.';
  if (input.matchId && input.tournamentId) {
    return 'Un cobro es de un partido o de un torneo, no de los dos.';
  }
  return null;
}

/** `covered`: la parte la asumió el equipo, o (para quien la debía) otro jugador. */
export type ShareStatus = 'paid' | 'partial' | 'pending' | 'covered';

/** Pagó todo, abonó una parte o no ha pagado: solo cuentan los pagos confirmados. */
export function shareStatus(amount: number, paid: number): ShareStatus {
  if (paid >= amount) return 'paid';
  return paid > 0 ? 'partial' : 'pending';
}

/** Lo que todavía puede reportar o registrar: lo que debe menos lo confirmado y lo reportado. */
export function payable(amount: number, confirmed: number, reported: number): number {
  return Math.max(amount - confirmed - reported, 0);
}

/** El saldo de un cobro (o de varios): cuánto se cobró, cuánto entró y cuánto falta. */
export function chargeBalance(shares: readonly { amount: number; paid: number }[]): {
  billed: number;
  collected: number;
  pending: number;
} {
  let billed = 0;
  let collected = 0;
  let pending = 0;
  for (const s of shares) {
    billed += s.amount;
    collected += s.paid;
    pending += Math.max(s.amount - s.paid, 0);
  }
  return { billed, collected, pending };
}

/**
 * Patrocinios (2026-10-31, Kevin): la parte entera de alguien la asume otro jugador del equipo o
 * el equipo. Se pone, se cambia o se quita solo mientras esa parte no tenga pagos (ni por
 * confirmar): así nadie pierde lo que abonó. Devuelve qué lo impide, en palabras, o null.
 */
export function sponsorProblem(input: {
  /** Que quien patrocina sea el mismo que debe. */
  self: boolean;
  confirmed: number;
  reported: number;
}): string | null {
  if (input.self) return 'Nadie se patrocina a sí mismo.';
  if (input.confirmed > 0) return 'Esta parte ya tiene pagos: el patrocinio ya no se cambia.';
  if (input.reported > 0) return 'Primero revisa el pago que está por confirmar.';
  return null;
}

/**
 * Quién debe cuánto en varios cobros (el saldo del equipo, 2026-10-31): la deuda de cada parte es
 * de quien la patrocina, si alguien la asumió, o de quien la debe; lo que cubre el equipo no es de
 * nadie. Solo los que deben algo, de mayor a menor deuda; `parts`, en cuántas partes.
 */
export function whoOwes(
  shares: readonly {
    userId: string;
    sponsorId: string | null;
    teamCovers: boolean;
    amount: number;
    paid: number;
  }[],
): { userId: string; owed: number; parts: number }[] {
  const debts = new Map<string, { owed: number; parts: number }>();
  for (const s of shares) {
    const owed = s.amount - s.paid;
    if (s.teamCovers || owed <= 0) continue;
    const who = s.sponsorId ?? s.userId;
    const debt = debts.get(who) ?? { owed: 0, parts: 0 };
    debts.set(who, { owed: debt.owed + owed, parts: debt.parts + 1 });
  }
  return [...debts].map(([userId, d]) => ({ userId, ...d })).sort((a, b) => b.owed - a.owed);
}

/** La zona de los equipos (Colombia, sin horario de verano): manda en qué día es "hoy". */
export const CHARGES_TIME_ZONE = 'America/Bogota';

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: CHARGES_TIME_ZONE });

/** El día (YYYY-MM-DD) de un instante en Colombia. */
export const localDay = (at: Date): string => DAY.format(at);

/**
 * Recordatorio automático (2026-10-31, Kevin): el día antes y el día que vence un cobro con fecha
 * límite, aviso a los que deben su parte. `tomorrow` o `today` si toca hoy, o null.
 */
export function dueStage(dueOn: string | null, now: Date): 'tomorrow' | 'today' | null {
  if (!dueOn) return null;
  if (dueOn === localDay(now)) return 'today';
  if (dueOn === localDay(new Date(now.getTime() + 86_400_000))) return 'tomorrow';
  return null;
}
