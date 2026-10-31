import type { MyChargesResponse, PaymentMethod } from '@sdl/contracts';
import { payable } from '@sdl/domain';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { SectionHead } from '../../shared/ui/SectionHead';
import { Sheet } from '../../shared/ui/Sheet';
import {
  chargeContext,
  chargeTitle,
  dueLine,
  parsePesos,
  pesos,
  shareBadge,
  today,
} from './charge-view';
import { failure, MethodPicker, MoneyField } from './ChargePage';
import { KIND_ICON } from './ChargesPage';
import styles from './Charges.module.css';
import { useMyCharges, useReportPayment } from './use-charges';

type Item = MyChargesResponse['items'][number];

/** Un cobro puede traer la parte propia y la de un compañero que patrocina. */
const itemKey = (i: Item) => `${i.charge.id}:${i.forPlayer?.userId ?? 'mia'}`;

/** "Arbitraje" o, si es la parte de un compañero que patrocina, "Arbitraje de Ciro". */
const itemTitle = (i: Item) =>
  i.forPlayer ? `${chargeTitle(i.charge)} de ${i.forPlayer.displayName}` : chargeTitle(i.charge);

/**
 * /equipos/:teamId/mis-cuentas — lo que debe y pagó cada jugador en los cobros del equipo: solo
 * lo suyo (`06` Cobros). "Ya pagué" avisa al tesorero, que lo confirma cuando le llegue.
 */
export function MyChargesPage({ teamId }: { teamId: string }) {
  const mine = useMyCharges(teamId);
  const [paying, setPaying] = useState<Item | null>(null);
  const back = (
    <Link to={`/equipos/${teamId}/mi-juego`} className={styles.back}>
      Mi juego
    </Link>
  );
  if (mine.isPending) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p className="sr-only" role="status">
          Cargando tus cuentas…
        </p>
      </Screen>
    );
  }
  if (mine.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert" className={styles.error}>
          No pudimos cargar tus cuentas. Revisa tu conexión e intenta de nuevo.
        </p>
      </Screen>
    );
  }
  const { items, owed } = mine.data;
  const settled = (i: Item) => i.status === 'paid' || i.status === 'covered';
  const open = items.filter((i) => !settled(i));
  const done = items.filter(settled);
  const openCharges = new Set(open.map((i) => i.charge.id)).size;

  return (
    <Screen className={styles.screen}>
      {back}
      <PageTitle eyebrow="Mi juego" title="Tus cuentas" />
      <section aria-label="Lo que debes" className={styles.lead}>
        <span className={styles.leadLabel}>{owed > 0 ? 'Debes' : 'Estás al día'}</span>
        <span className={styles.leadAmount}>{pesos(owed)}</span>
        <span className={styles.leadSub}>
          {openCharges === 0
            ? 'No debes nada en los cobros del equipo.'
            : `En ${openCharges} ${openCharges === 1 ? 'cobro' : 'cobros'} del equipo.`}
        </span>
      </section>

      {open.length > 0 && (
        <ul className={styles.list} aria-label="Lo que debes">
          {open.map((item) => (
            <li key={itemKey(item)}>
              <Debt item={item} onPay={() => setPaying(item)} />
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section aria-labelledby="pagados" className={styles.section}>
          <SectionHead
            id="pagados"
            title={done.some((i) => i.status === 'covered') ? 'Pagados y cubiertos' : 'Pagados'}
          />
          <ul className={styles.list}>
            {done.map((item) => (
              <li key={itemKey(item)}>
                <Debt item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={paying !== null}
        onClose={() => setPaying(null)}
        title={paying ? `Ya pagué: ${itemTitle(paying).toLowerCase()}` : ''}
      >
        {paying && (
          <PayForm
            key={itemKey(paying)}
            teamId={teamId}
            item={paying}
            onDone={() => setPaying(null)}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function Debt({ item, onPay }: { item: Item; onPay?: () => void }) {
  const Glyph = KIND_ICON[item.charge.kind];
  const badge = shareBadge(item, true);
  const covered = item.status === 'covered';
  const left = payable(item.amount, item.paid, item.reported);
  const context = [chargeContext(item.charge), item.charge.dueOn && dueLine(item.charge.dueOn)]
    .filter(Boolean)
    .join(', ');
  return (
    <div className={styles.section}>
      <Row
        leading={
          <span className={styles.icon} aria-hidden="true">
            <Glyph size={22} />
          </span>
        }
        title={itemTitle(item)}
        meta={
          <span className={styles.metaLine}>
            {context && <span>{context}</span>}
            <Badge tone={badge.tone} size="sm">
              {badge.label}
            </Badge>
          </span>
        }
        trailing={
          <span className={styles.amount}>
            {pesos(covered ? 0 : Math.max(item.amount - item.paid, 0))}
            <small>
              {covered
                ? `eran ${pesos(item.amount)}`
                : item.status === 'paid'
                  ? `pagaste ${pesos(item.paid)}`
                  : `de ${pesos(item.amount)}`}
            </small>
          </span>
        }
      />
      {onPay && item.forPlayer && (
        <p className={styles.note}>
          Asumiste la parte de <b>{item.forPlayer.displayName}</b>: la pagas tú.
        </p>
      )}
      {onPay && item.reported > 0 && (
        <p className={styles.note}>
          Avisaste que pagaste <b>{pesos(item.reported)}</b>: falta que el tesorero lo confirme.
        </p>
      )}
      {onPay && left > 0 && (
        <Button variant="accent" onClick={onPay}>
          Ya pagué
        </Button>
      )}
    </div>
  );
}

function PayForm({ teamId, item, onDone }: { teamId: string; item: Item; onDone: () => void }) {
  const id = useId();
  const report = useReportPayment(teamId);
  const left = payable(item.amount, item.paid, item.reported);
  const [amount, setAmount] = useState(pesos(left));
  const [method, setMethod] = useState<PaymentMethod>('nequi');
  const value = parsePesos(amount);
  return (
    <form
      className={styles.sheetBody}
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        report.mutate(
          {
            chargeId: item.charge.id,
            amount: value,
            method,
            paidOn: today(),
            ...(item.forPlayer ? { forUserId: item.forPlayer.userId } : {}),
          },
          { onSuccess: onDone },
        );
      }}
    >
      <MoneyField
        id={`${id}-cuanto`}
        label="Cuánto pagaste"
        value={amount}
        onChange={setAmount}
        invalid={value !== null && value > left}
      />
      <MethodPicker value={method} onChange={setMethod} />
      <p className={styles.note}>
        El tesorero lo confirma cuando le llegue. Si pagaste una parte, pon solo lo que pagaste
        (falta <b>{pesos(left)}</b>).
      </p>
      {report.isError && (
        <p role="alert" className={styles.error}>
          {failure(report.error, 'No pudimos avisar. Revisa tu conexión.')}
        </p>
      )}
      <Button
        type="submit"
        variant="accent"
        busy={report.isPending}
        disabled={!value || value > left}
      >
        Avisar que pagué
      </Button>
    </form>
  );
}
