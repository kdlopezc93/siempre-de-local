import type { ChargeResponse, ChargeShare, PaymentMethod } from '@sdl/contracts';
import { PAYMENT_METHOD_LABELS, payable, splitTotal } from '@sdl/domain';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { SectionHead } from '../../shared/ui/SectionHead';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useTeamMembers } from '../team-roles/use-team-roles';
import {
  chargeContext,
  chargeTitle,
  dueLine,
  parsePesos,
  pesos,
  shareBadge,
  today,
  vacaMarks,
} from './charge-view';
import { VacaStrip } from './ChargesPage';
import styles from './Charges.module.css';
import {
  useCharge,
  useRegisterPayment,
  useReviewPayment,
  useSetShare,
  useSetSponsor,
  useUpdateCharge,
} from './use-charges';

export const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export const failure = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

const token = (p: { jerseyNumber: number | null; displayName: string }) =>
  p.jerseyNumber !== null ? String(p.jerseyNumber) : initialsOf(p.displayName);

/** "La paga Beto": quién asumió la parte (patrocinio); lo del equipo ya lo dice el estado. */
const sponsorLine = (s: ChargeShare) =>
  s.sponsor?.kind === 'member' ? `La paga ${s.sponsor.displayName}` : null;

/**
 * /equipos/:teamId/cobros/:chargeId — un cobro (`06` Cobros): lo que falta, los "Ya pagué" que
 * esperan (confirmar o "No llegó") y lo de cada uno. Tocar a alguien abre su hoja: registrar su
 * pago o abono, ajustar lo que debe o que se la pague otro (patrocinio).
 */
export function ChargePage({ teamId, chargeId }: { teamId: string; chargeId: string }) {
  const data = useCharge(teamId, chargeId);
  const [person, setPerson] = useState<ChargeShare | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const back = (
    <Link to={`/equipos/${teamId}/cobros`} className={styles.back}>
      Cobros
    </Link>
  );
  if (data.isPending) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p className="sr-only" role="status">
          Cargando el cobro…
        </p>
      </Screen>
    );
  }
  if (data.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert" className={styles.error}>
          {data.error instanceof ApiError && data.error.status === 404
            ? 'No encontramos ese cobro.'
            : 'No pudimos cargar el cobro. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  const { charge, shares, payments } = data.data;
  const { marks, label } = vacaMarks(shares);
  const waiting = payments.filter((p) => p.status === 'reported');
  const nameOf = new Map(shares.map((s) => [s.userId, s]));
  const context = [chargeContext(charge), charge.dueOn && dueLine(charge.dueOn)]
    .filter(Boolean)
    .join(', ');

  return (
    <Screen className={styles.screen}>
      {back}
      <PageTitle eyebrow={context || 'Cobro suelto'} title={chargeTitle(charge)} />
      <section aria-label="Saldo del cobro" className={styles.lead}>
        <span className={styles.leadLabel}>{charge.cancelled ? 'Anulado' : 'Falta'}</span>
        <span className={styles.leadAmount}>{pesos(charge.balance.pending)}</span>
        {shares.length > 1 && <VacaStrip marks={marks} label={label} />}
        <span className={styles.leadSub}>
          <SplitLine data={data.data} />
        </span>
      </section>

      {!charge.cancelled && waiting.length > 0 && (
        <section aria-labelledby="esperan" className={styles.section}>
          <SectionHead id="esperan" title="Dicen que pagaron" />
          {waiting.map((p) => {
            const who = nameOf.get(p.userId);
            // Quien patrocina paga la parte de otro: se dice de quién es.
            const sponsor =
              who?.sponsor?.kind === 'member' && p.reportedBy?.id === who.sponsor.userId
                ? who.sponsor.displayName
                : null;
            return (
              <Reported
                key={p.id}
                teamId={teamId}
                chargeId={charge.id}
                paymentId={p.id}
                name={sponsor ?? who?.displayName ?? 'Alguien'}
                token={sponsor ? initialsOf(sponsor) : who ? token(who) : '?'}
                text={`${pesos(p.amount)} por ${PAYMENT_METHOD_LABELS[p.method]}`}
                forName={sponsor ? (who?.displayName ?? null) : null}
              />
            );
          })}
        </section>
      )}

      <section aria-labelledby="cada-uno" className={styles.section}>
        <SectionHead id="cada-uno" title="Cada uno" />
        {!charge.cancelled && (
          <p className={styles.muted}>
            Toca a alguien para registrar su pago, ajustar lo suyo o que se lo pague otro.
          </p>
        )}
        <ul className={styles.list}>
          {shares.map((s) => {
            const badge = shareBadge(s);
            const by = sponsorLine(s);
            const covered = s.status === 'covered';
            return (
              <li key={s.userId}>
                <button
                  type="button"
                  className={styles.pickRow}
                  disabled={charge.cancelled}
                  onClick={() => setPerson(s)}
                  aria-label={
                    covered
                      ? `${s.displayName}: ${badge.label}, ${pesos(s.amount)}`
                      : `${s.displayName}: ${badge.label}${s.sponsor?.kind === 'member' ? `, la paga ${s.sponsor.displayName}` : ''}, pagó ${pesos(s.paid)} de ${pesos(s.amount)}`
                  }
                >
                  <Avatar name={s.displayName} label={token(s)} size={40} />
                  <span className={styles.pickName}>
                    {s.displayName}
                    <span className={styles.metaLine}>
                      <Badge tone={badge.tone} size="sm">
                        {badge.label}
                      </Badge>
                      {by && <small>{by}</small>}
                      {s.note && <small>{s.note}</small>}
                    </span>
                  </span>
                  <span className={styles.amount}>
                    {covered ? pesos(s.amount) : pesos(s.paid)}
                    <small>{covered ? 'el equipo' : `de ${pesos(s.amount)}`}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {!charge.cancelled && (
        <button type="button" className={styles.quiet} onClick={() => setCancelling(true)}>
          Anular el cobro
        </button>
      )}

      <PersonSheet
        teamId={teamId}
        chargeId={charge.id}
        share={person}
        onClose={() => setPerson(null)}
      />
      <CancelSheet
        teamId={teamId}
        chargeId={charge.id}
        open={cancelling}
        onClose={() => setCancelling(false)}
      />
    </Screen>
  );
}

/** "$70.000 repartidos entre 3, $23.400 cada uno. Sobran $200." o "$40.000 cada uno." */
function SplitLine({ data }: { data: ChargeResponse }) {
  const { charge, shares } = data;
  if (charge.split === 'total' && shares.length > 0) {
    const { share, surplus } = splitTotal(charge.amount, shares.length);
    return (
      <>
        <b>{pesos(charge.amount)}</b> repartidos entre {shares.length}, <b>{pesos(share)}</b> cada
        uno.
        {surplus > 0 && (
          <>
            {' '}
            Sobran <b>{pesos(surplus)}</b>.
          </>
        )}
      </>
    );
  }
  return (
    <>
      <b>{pesos(charge.amount)}</b> {shares.length === 1 ? 'en total' : 'cada uno'}. Entró{' '}
      <b>{pesos(charge.balance.collected)}</b>.
    </>
  );
}

function Reported({
  teamId,
  chargeId,
  paymentId,
  name,
  token: label,
  text,
  forName,
}: {
  teamId: string;
  chargeId: string;
  paymentId: string;
  name: string;
  token: string;
  text: string;
  /** Si paga la parte de otro (patrocinio), de quién. */
  forName: string | null;
}) {
  const review = useReviewPayment(teamId, chargeId);
  return (
    <div className={styles.reported}>
      <div className={styles.reportedWho}>
        <Avatar name={name} label={label} size={40} />
        <p>
          <b>{name}</b> dice que pagó{forName && <> lo de {forName}</>}{' '}
          <span className={styles.money}>{text}</span>.
        </p>
      </div>
      {review.isError && (
        <p role="alert" className={styles.error}>
          {failure(review.error, 'No pudimos guardar. Revisa tu conexión.')}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          busy={review.isPending && review.variables?.decision === 'confirm'}
          disabled={review.isPending}
          onClick={() => review.mutate({ paymentId, decision: 'confirm' })}
        >
          Confirmar
        </Button>
        <Button
          variant="secondary"
          busy={review.isPending && review.variables?.decision === 'reject'}
          disabled={review.isPending}
          onClick={() => review.mutate({ paymentId, decision: 'reject' })}
        >
          No llegó
        </Button>
      </div>
    </div>
  );
}

/** El medio de pago, como opciones elegibles. */
export function MethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>Por dónde</legend>
      <div className={styles.options}>
        {METHODS.map(([method, text]) => (
          <button
            key={method}
            type="button"
            className={styles.option}
            aria-pressed={value === method}
            onClick={() => onChange(method)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** El campo de plata: teclado numérico, la cifra en grande. */
export function MoneyField({
  id,
  label,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={`${styles.input} ${styles.moneyInput}`}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid}
        value={value}
        onChange={(e) => {
          const amount = parsePesos(e.target.value);
          onChange(amount === null ? '' : pesos(amount));
        }}
      />
    </div>
  );
}

/** La hoja de una persona: registrar su pago o abono, o ajustar lo que debe. */
function PersonSheet({
  teamId,
  chargeId,
  share,
  onClose,
}: {
  teamId: string;
  chargeId: string;
  share: ChargeShare | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={share !== null} onClose={onClose} title={share?.displayName ?? ''}>
      {share && (
        <PersonForms
          key={share.userId}
          teamId={teamId}
          chargeId={chargeId}
          share={share}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function PersonForms({
  teamId,
  chargeId,
  share,
  onDone,
}: {
  teamId: string;
  chargeId: string;
  share: ChargeShare;
  onDone: () => void;
}) {
  const covered = share.status === 'covered';
  const left = covered ? 0 : payable(share.amount, share.paid, share.reported);
  const [mode, setMode] = useState<'pay' | 'adjust' | 'sponsor'>(left > 0 ? 'pay' : 'adjust');
  const id = useId();
  const pay = useRegisterPayment(teamId, chargeId);
  const adjust = useSetShare(teamId, chargeId);
  const [amount, setAmount] = useState(pesos(left));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [owes, setOwes] = useState(pesos(share.amount));
  const [note, setNote] = useState(share.note ?? '');
  const value = parsePesos(amount);
  const owesValue = parsePesos(owes);

  return (
    <div className={styles.sheetBody}>
      {covered ? (
        <p className={styles.note}>
          El equipo le cubre su parte: <b>{pesos(share.amount)}</b>.
        </p>
      ) : (
        <p className={styles.note}>
          Debe <b>{pesos(share.amount)}</b>, pagó <b>{pesos(share.paid)}</b>
          {share.reported > 0 && (
            <>
              {' '}
              y dice que pagó <b>{pesos(share.reported)}</b> más
            </>
          )}
          .{share.sponsor?.kind === 'member' && <> {sponsorLine(share)}.</>}
        </p>
      )}
      <div className={styles.options} role="group" aria-label="Qué hacer">
        <button
          type="button"
          className={styles.option}
          aria-pressed={mode === 'pay'}
          disabled={left === 0}
          onClick={() => setMode('pay')}
        >
          Registrar un pago
        </button>
        <button
          type="button"
          className={styles.option}
          aria-pressed={mode === 'adjust'}
          onClick={() => setMode('adjust')}
        >
          Ajustar lo que debe
        </button>
        <button
          type="button"
          className={styles.option}
          aria-pressed={mode === 'sponsor'}
          onClick={() => setMode('sponsor')}
        >
          Lo paga otro
        </button>
      </div>

      {mode === 'sponsor' ? (
        <SponsorForm teamId={teamId} chargeId={chargeId} share={share} onDone={onDone} />
      ) : mode === 'pay' ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!value) return;
            pay.mutate(
              { userId: share.userId, amount: value, method, paidOn: today() },
              { onSuccess: onDone },
            );
          }}
        >
          <MoneyField
            id={`${id}-pago`}
            label={`Cuánto pagó (falta ${pesos(left)})`}
            value={amount}
            onChange={setAmount}
            invalid={value !== null && value > left}
          />
          <MethodPicker value={method} onChange={setMethod} />
          {pay.isError && (
            <p role="alert" className={styles.error}>
              {failure(pay.error, 'No pudimos guardar el pago. Revisa tu conexión.')}
            </p>
          )}
          <Button type="submit" busy={pay.isPending} disabled={!value || value > left}>
            Registrar el pago
          </Button>
        </form>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (owesValue === null) return;
            adjust.mutate(
              { userId: share.userId, amount: owesValue, note: note.trim() || null },
              { onSuccess: onDone },
            );
          }}
        >
          <MoneyField
            id={`${id}-debe`}
            label="Lo que debe"
            value={owes}
            onChange={setOwes}
            invalid={owesValue !== null && owesValue < share.paid}
          />
          <div className={styles.field}>
            <label htmlFor={`${id}-nota`} className={styles.label}>
              Nota (opcional)
            </label>
            <input
              id={`${id}-nota`}
              name="nota"
              className={styles.input}
              maxLength={140}
              autoComplete="off"
              placeholder="Media beca…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className={styles.note}>
            No puede quedar por debajo de lo que ya pagó. En cero, el equipo le asume su parte.
          </p>
          {adjust.isError && (
            <p role="alert" className={styles.error}>
              {failure(adjust.error, 'No pudimos guardar. Revisa tu conexión.')}
            </p>
          )}
          <Button
            type="submit"
            busy={adjust.isPending}
            disabled={owesValue === null || owesValue < share.paid}
          >
            Guardar
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Patrocinio (2026-10-31): la parte entera la asume otro jugador del equipo (la ve y la paga en
 * Tus cuentas) o el equipo. Quien la debía la ve cubierta, sin saber quién. Solo mientras no
 * tenga pagos; así, quitarlo no le quita a nadie lo que abonó.
 */
function SponsorForm({
  teamId,
  chargeId,
  share,
  onDone,
}: {
  teamId: string;
  chargeId: string;
  share: ChargeShare;
  onDone: () => void;
}) {
  const members = useTeamMembers(teamId);
  const sponsor = useSetSponsor(teamId, chargeId);
  const current =
    share.sponsor?.kind === 'team' ? 'team' : share.sponsor ? share.sponsor.userId : null;
  const [choice, setChoice] = useState<string | null>(current);
  const others = (members.data?.players ?? []).filter((p) => p.userId !== share.userId);
  const locked = share.paid > 0 || share.reported > 0;
  const save = (value: string | null) =>
    sponsor.mutate({ userId: share.userId, sponsor: value }, { onSuccess: onDone });

  if (locked) {
    return (
      <p className={styles.note}>
        {share.paid > 0
          ? 'Esta parte ya tiene pagos: ya no se le cambia quién la paga.'
          : 'Primero confirma o rechaza el pago que está por confirmar.'}
      </p>
    );
  }
  return (
    <div className={styles.form}>
      <fieldset className={styles.field}>
        <legend className={styles.label}>Quién paga su parte</legend>
        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            aria-pressed={choice === 'team'}
            onClick={() => setChoice('team')}
          >
            El equipo
          </button>
          {others.map((p) => (
            <button
              key={p.userId}
              type="button"
              className={styles.option}
              aria-pressed={choice === p.userId}
              onClick={() => setChoice(p.userId)}
            >
              {p.displayName}
            </button>
          ))}
        </div>
      </fieldset>
      {members.isPending && (
        <p className="sr-only" role="status">
          Cargando a los jugadores…
        </p>
      )}
      <p className={styles.note}>
        {choice === 'team'
          ? 'Sale de la caja del equipo: no se le cobra a nadie.'
          : 'Esa persona la ve en sus cuentas y la paga como la suya.'}{' '}
        {share.displayName} la ve cubierta, sin saber quién.
      </p>
      {sponsor.isError && (
        <p role="alert" className={styles.error}>
          {failure(sponsor.error, 'No pudimos guardar. Revisa tu conexión.')}
        </p>
      )}
      <Button
        busy={sponsor.isPending && sponsor.variables?.sponsor !== null}
        disabled={choice === null || choice === current || sponsor.isPending}
        onClick={() => save(choice)}
      >
        Guardar
      </Button>
      {current !== null && (
        <Button
          variant="ghost"
          busy={sponsor.isPending && sponsor.variables?.sponsor === null}
          disabled={sponsor.isPending}
          onClick={() => save(null)}
        >
          Que la pague {share.displayName}
        </Button>
      )}
    </div>
  );
}

/** Anular pide confirmar: sale del saldo y de lo que debe cada uno, y no se deshace. */
function CancelSheet({
  teamId,
  chargeId,
  open,
  onClose,
}: {
  teamId: string;
  chargeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateCharge(teamId, chargeId);
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="¿Anular el cobro?">
      <div className={styles.sheetBody}>
        <p className={styles.note}>
          Sale del saldo y de lo que debe cada uno, y ya no recibe pagos. Queda en la lista como
          anulado. No se puede deshacer.
        </p>
        {update.isError && (
          <p role="alert" className={styles.error}>
            {failure(update.error, 'No pudimos anularlo. Revisa tu conexión.')}
          </p>
        )}
        <Button
          variant="danger"
          busy={update.isPending}
          onClick={() =>
            update.mutate(
              { cancelled: true },
              { onSuccess: () => void navigate(`/equipos/${teamId}/cobros`) },
            )
          }
        >
          Anular el cobro
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Seguir con el cobro
        </Button>
      </div>
    </Sheet>
  );
}
