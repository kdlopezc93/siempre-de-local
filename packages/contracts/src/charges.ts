import { z } from 'zod';

/** Cobros del equipo (`06` Cobros, `02` §15). La plata, en pesos enteros. */
export const ChargeKindSchema = z.enum([
  'registration',
  'referee',
  'vaca',
  'fee',
  'fine',
  'uniform',
  'other',
]);
export const ChargeSplitSchema = z.enum(['per_person', 'total']);
export const PaymentMethodSchema = z.enum(['cash', 'nequi', 'daviplata', 'transfer', 'other']);
export const PaymentStatusSchema = z.enum(['reported', 'confirmed', 'rejected']);
/** `covered`: la asumió el equipo, o (en lo de quien la debía) otro jugador. */
export const ShareStatusSchema = z.enum(['paid', 'partial', 'pending', 'covered']);

const Pesos = z.int().min(1).max(100_000_000);
const Day = z.iso.date();
const Title = z
  .string()
  .trim()
  .max(80)
  .transform((title) => title || null);
const Note = z
  .string()
  .trim()
  .max(140)
  .transform((note) => note || null);

const PersonSchema = z.object({ id: z.uuid(), name: z.string() });

/** De qué es el cobro: un partido, un torneo o nada (suelto). */
const ChargeContextSchema = {
  match: z
    .object({ id: z.uuid(), opponent: z.string().nullable(), startsAt: z.iso.datetime() })
    .nullable(),
  tournament: z.object({ id: z.uuid(), name: z.string() }).nullable(),
};

/** El saldo: cuánto se cobró, cuánto entró y cuánto falta (`chargeBalance`). */
export const ChargeBalanceSchema = z.object({
  billed: z.int(),
  collected: z.int(),
  pending: z.int(),
});

export const ChargeSummarySchema = z.object({
  id: z.uuid(),
  kind: ChargeKindSchema,
  title: z.string().nullable(),
  ...ChargeContextSchema,
  split: ChargeSplitSchema,
  /** El valor por persona, o el total que se repartió. */
  amount: z.int(),
  dueOn: Day.nullable(),
  createdAt: z.iso.datetime(),
  cancelled: z.boolean(),
  balance: ChargeBalanceSchema,
  /** Cuántos deben algo, cuántos ya pagaron todo y cuántos "Ya pagué" esperan confirmación. */
  people: z.int(),
  paidPeople: z.int(),
  reported: z.int(),
  /** Lo que asumió el equipo (patrocinios): no entra en el saldo, sale de la caja. */
  teamCovered: z.int(),
});

/** Quién asume una parte: el id de otro jugador del equipo, o `'team'`. */
const SponsorSchema = z.union([z.literal('team'), z.uuid()]);

/**
 * POST /teams/:teamId/charges — crear un cobro (cuerpo técnico y tesorero). A quién se le cobra
 * lo elige quien lo crea (los que vinieron, todos o a mano): `playerIds`. Con `split: 'total'`,
 * `amount` se reparte con `splitTotal` (cada parte a los $100 siguientes). `sponsors`: las partes
 * que desde el comienzo asume otro jugador o el equipo (patrocinios).
 */
export const CreateChargeRequestSchema = z.object({
  kind: ChargeKindSchema,
  title: Title.nullable().optional(),
  matchId: z.uuid().nullable().optional(),
  tournamentId: z.uuid().nullable().optional(),
  split: ChargeSplitSchema,
  amount: Pesos,
  dueOn: Day.nullable().optional(),
  playerIds: z.array(z.uuid()).min(1).max(100),
  sponsors: z
    .array(z.object({ userId: z.uuid(), sponsor: SponsorSchema }))
    .max(100)
    .optional(),
});

/** PATCH /teams/:teamId/charges/:chargeId — título, fecha límite o anularlo. */
export const UpdateChargeRequestSchema = z
  .object({
    title: Title.nullable(),
    dueOn: Day.nullable(),
    cancelled: z.literal(true),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

/**
 * PUT /teams/:teamId/charges/:chargeId/shares/:userId — ajustar lo que debe alguien (o sumarlo
 * al cobro). No baja de lo que ya pagó.
 */
export const ShareRequestSchema = z.object({
  amount: z.int().min(0).max(100_000_000),
  note: Note.nullable().optional(),
});

/**
 * PUT /teams/:teamId/charges/:chargeId/shares/:userId/sponsor — que la parte entera de alguien la
 * asuma otro jugador del equipo (su id) o el equipo (`'team'`); `null` la devuelve a quien la
 * debía. Solo mientras esa parte no tenga pagos.
 */
export const SponsorRequestSchema = z.object({ sponsor: SponsorSchema.nullable() });

/**
 * POST /teams/:teamId/charges/:chargeId/payments — un pago o abono que registra el cuerpo técnico
 * o el tesorero: queda confirmado.
 */
export const PaymentRequestSchema = z.object({
  userId: z.uuid(),
  amount: Pesos,
  method: PaymentMethodSchema,
  paidOn: Day,
});

/**
 * POST /teams/:teamId/me/charges/:chargeId/payments — el "Ya pagué" del jugador (o un abono):
 * queda reportado hasta que el tesorero o el cuerpo técnico lo confirmen.
 */
export const MyPaymentRequestSchema = PaymentRequestSchema.omit({ userId: true }).extend({
  /** Pagar la parte de un compañero que patrocina quien reporta. */
  forUserId: z.uuid().optional(),
});

export const PaymentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  amount: z.int(),
  method: PaymentMethodSchema,
  paidOn: Day,
  status: PaymentStatusSchema,
  reportedBy: PersonSchema.nullable(),
  reviewedBy: PersonSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export const ChargeShareSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  jerseyNumber: z.int().nullable(),
  amount: z.int(),
  note: z.string().nullable(),
  /** Confirmado; los reportados van aparte hasta que los confirmen. */
  paid: z.int(),
  reported: z.int(),
  status: ShareStatusSchema,
  /** Quién la asumió: otro jugador o el equipo. Solo lo ven el cuerpo técnico y el tesorero. */
  sponsor: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('member'), userId: z.uuid(), displayName: z.string() }),
      z.object({ kind: z.literal('team') }),
    ])
    .nullable(),
});

/** GET /teams/:teamId/charges/:chargeId — el cobro, lo de cada uno y los pagos. */
export const ChargeResponseSchema = z.object({
  charge: ChargeSummarySchema,
  shares: z.array(ChargeShareSchema),
  payments: z.array(PaymentSchema),
});

/** El saldo de varios cobros: el de cada uno, más lo que puso el equipo (patrocinios). */
export const TeamBalanceSchema = ChargeBalanceSchema.extend({ teamCovered: z.int() });

/**
 * GET /teams/:teamId/charges — los cobros del equipo, el más nuevo primero, con el saldo (sin los
 * anulados): el total, el de cada torneo (sus cobros y los de sus partidos) y quién debe, de
 * mayor a menor (lo patrocinado lo debe quien lo asumió).
 */
export const ChargeListResponseSchema = z.object({
  items: z.array(ChargeSummarySchema),
  balance: TeamBalanceSchema,
  byTournament: z.array(
    z.object({
      tournament: z.object({ id: z.uuid(), name: z.string() }),
      balance: TeamBalanceSchema,
      charges: z.int(),
    }),
  ),
  debtors: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      owed: z.int(),
      /** En cuántas partes (de cobros distintos, o la suya y una que patrocina). */
      parts: z.int(),
    }),
  ),
});

/**
 * POST /teams/:teamId/charges/reminders — "Recordar a los que deben": un aviso a cada uno que debe
 * algo (sin el valor). `reminded`: a cuántos.
 */
export const ChargesReminderResponseSchema = z.object({ reminded: z.int() });

/**
 * GET /teams/:teamId/me/charges — lo que debe y pagó quien pregunta, en los cobros vigentes: lo
 * suyo y nada de los demás. Su parte, si se la cubrieron, viene `covered` sin decir quién; la de
 * un compañero que patrocina viene aparte, con `forPlayer`.
 */
export const MyChargesResponseSchema = z.object({
  items: z.array(
    z.object({
      charge: ChargeSummarySchema.pick({
        id: true,
        kind: true,
        title: true,
        match: true,
        tournament: true,
        dueOn: true,
        createdAt: true,
      }),
      /** La parte de un compañero que asumió quien pregunta; null si es la suya. */
      forPlayer: z.object({ userId: z.uuid(), displayName: z.string() }).nullable(),
      amount: z.int(),
      paid: z.int(),
      reported: z.int(),
      status: ShareStatusSchema,
      payments: z.array(PaymentSchema.omit({ reportedBy: true, reviewedBy: true })),
    }),
  ),
  /** Lo que debe en total (sin contar lo reportado que falta confirmar). */
  owed: z.int(),
});

export type ChargeKind = z.infer<typeof ChargeKindSchema>;
export type ChargeSplit = z.infer<typeof ChargeSplitSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type ChargeSummary = z.infer<typeof ChargeSummarySchema>;
export type CreateChargeRequest = z.input<typeof CreateChargeRequestSchema>;
export type UpdateChargeRequest = z.input<typeof UpdateChargeRequestSchema>;
export type ShareRequest = z.input<typeof ShareRequestSchema>;
export type SponsorRequest = z.infer<typeof SponsorRequestSchema>;
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;
export type MyPaymentRequest = z.infer<typeof MyPaymentRequestSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type ChargeShare = z.infer<typeof ChargeShareSchema>;
export type ChargeResponse = z.infer<typeof ChargeResponseSchema>;
export type ChargeListResponse = z.infer<typeof ChargeListResponseSchema>;
export type TeamBalance = z.infer<typeof TeamBalanceSchema>;
export type ChargesReminderResponse = z.infer<typeof ChargesReminderResponseSchema>;
export type MyChargesResponse = z.infer<typeof MyChargesResponseSchema>;
