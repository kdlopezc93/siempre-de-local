import type { Icon } from '@phosphor-icons/react';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { Cards } from '@phosphor-icons/react/dist/csr/Cards';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { TShirt } from '@phosphor-icons/react/dist/csr/TShirt';
import type { ChargeKind, ChargeListResponse, ChargeSummary } from '@sdl/contracts';
import { useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { SectionHead } from '../../shared/ui/SectionHead';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import {
  chargeContext,
  chargeTitle,
  dueLine,
  pesos,
  summaryMarks,
  type VacaMark,
} from './charge-view';
import styles from './Charges.module.css';
import { useCharges, useRemindCharges } from './use-charges';

export const KIND_ICON: Record<ChargeKind, Icon> = {
  registration: Trophy,
  referee: Flag,
  vaca: Coins,
  fee: CalendarCheck,
  fine: Cards,
  uniform: TShirt,
  other: Receipt,
};

/** La fila de la vaca: una marca por persona (llena, pagó; media, abonó; vacía, debe). */
export function VacaStrip({
  marks,
  label,
  size = 'md',
}: {
  marks: readonly VacaMark[];
  label: string;
  size?: 'md' | 'sm';
}) {
  return (
    <ul className={styles.vaca} data-size={size} aria-label={label}>
      {marks.map((mark, i) => (
        <li key={i} className={styles.mark} data-mark={mark} />
      ))}
    </ul>
  );
}

/**
 * /equipos/:teamId/cobros — los cobros del equipo para el cuerpo técnico y el tesorero (`06`
 * Cobros): lo que falta por cobrar, los "Ya pagué" que esperan, quién debe (con "Recordar a los
 * que deben"), cada cobro y el saldo de cada torneo.
 */
export function ChargesPage({ teamId, teamName }: { teamId: string; teamName: string }) {
  const charges = useCharges(teamId);
  const back = (
    <Link to={`/equipos/${teamId}/equipo`} className={styles.back}>
      Equipo
    </Link>
  );
  if (charges.isPending) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p className="sr-only" role="status">
          Cargando los cobros…
        </p>
      </Screen>
    );
  }
  if (charges.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert" className={styles.error}>
          {charges.error instanceof ApiError && charges.error.status === 403
            ? 'Los cobros los ven el cuerpo técnico y el tesorero.'
            : 'No pudimos cargar los cobros. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  const { items, balance, byTournament, debtors } = charges.data;
  const live = items.filter((c) => !c.cancelled);
  const waiting = live.filter((c) => c.reported > 0);
  const cancelled = items.filter((c) => c.cancelled);

  return (
    <Screen className={styles.screen}>
      {back}
      <PageTitle eyebrow={teamName} title="Cobros" />
      <section aria-label="Saldo del equipo" className={styles.lead}>
        <span className={styles.leadLabel}>Falta por cobrar</span>
        <span className={styles.leadAmount}>{pesos(balance.pending)}</span>
        <span className={styles.leadSub}>
          {balance.billed > 0 || balance.teamCovered > 0 ? (
            <>
              Entró <b>{pesos(balance.collected)}</b> de <b>{pesos(balance.billed)}</b>.
              {balance.teamCovered > 0 && (
                <>
                  {' '}
                  El equipo puso <b>{pesos(balance.teamCovered)}</b>.
                </>
              )}
            </>
          ) : (
            'Todavía no hay cobros.'
          )}
        </span>
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="por-confirmar" className={styles.section}>
          <SectionHead
            id="por-confirmar"
            title={`Por confirmar (${waiting.reduce((n, c) => n + c.reported, 0)})`}
          />
          <ul className={styles.list}>
            {waiting.map((c) => (
              <li key={c.id}>
                <ChargeRow teamId={teamId} charge={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {debtors.length > 0 && <Debtors teamId={teamId} debtors={debtors} />}

      <section aria-labelledby="vigentes" className={styles.section}>
        <SectionHead id="vigentes" title="Vigentes" />
        {live.length === 0 ? (
          <p className={styles.muted}>
            Crea el primero: la vaca de un partido, la inscripción de un torneo o una cuota.
          </p>
        ) : (
          <ul className={styles.list}>
            {live
              .filter((c) => c.reported === 0)
              .map((c) => (
                <li key={c.id}>
                  <ChargeRow teamId={teamId} charge={c} />
                </li>
              ))}
          </ul>
        )}
      </section>

      <ButtonLink to={`/equipos/${teamId}/cobros/nuevo`}>Nuevo cobro</ButtonLink>

      {byTournament.length > 0 && (
        <section aria-labelledby="por-torneo" className={styles.section}>
          <SectionHead id="por-torneo" title="Por torneo" />
          <ul className={styles.list}>
            {byTournament.map(({ tournament, balance: b, charges: n }) => (
              <li key={tournament.id}>
                <Row
                  leading={
                    <span className={styles.icon} aria-hidden="true">
                      <Trophy size={22} />
                    </span>
                  }
                  title={tournament.name}
                  meta={
                    <span className={styles.metaLine}>
                      <span>
                        {n} {n === 1 ? 'cobro' : 'cobros'}, entró {pesos(b.collected)} de{' '}
                        {pesos(b.billed)}
                        {b.teamCovered > 0 && `, el equipo puso ${pesos(b.teamCovered)}`}
                      </span>
                    </span>
                  }
                  trailing={
                    <span className={styles.amount}>
                      {pesos(b.pending)}
                      <small>{b.pending ? 'falta' : 'completo'}</small>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <section aria-labelledby="anulados" className={styles.section}>
          <SectionHead id="anulados" title="Anulados" />
          <ul className={styles.list}>
            {cancelled.map((c) => (
              <li key={c.id}>
                <ChargeRow teamId={teamId} charge={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}

/** Cuántos se muestran de entrada en "Quién debe"; el resto, con "Ver los N". */
const DEBTORS_SHOWN = 5;

/**
 * Quién debe, de mayor a menor, en todos los cobros vigentes (lo patrocinado, en quien lo asumió),
 * y "Recordar a los que deben": un aviso a cada uno, sin el valor (2026-10-31, Kevin).
 */
function Debtors({ teamId, debtors }: { teamId: string; debtors: ChargeListResponse['debtors'] }) {
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const remind = useRemindCharges(teamId);
  const shown = all ? debtors : debtors.slice(0, DEBTORS_SHOWN);
  const people = debtors.length === 1 ? 'al que debe' : `a los ${debtors.length} que deben`;
  return (
    <section aria-labelledby="quien-debe" className={styles.section}>
      <SectionHead id="quien-debe" title={`Quién debe (${debtors.length})`} />
      <ul className={styles.list}>
        {shown.map((d) => (
          <li key={d.userId} className={`${styles.pickRow} ${styles.still}`}>
            <Avatar
              name={d.displayName}
              label={d.jerseyNumber !== null ? String(d.jerseyNumber) : initialsOf(d.displayName)}
              size={40}
            />
            <span className={styles.pickName}>
              {d.displayName}
              <small>
                {d.parts} {d.parts === 1 ? 'pendiente' : 'pendientes'}
              </small>
            </span>
            <span className={styles.amount}>{pesos(d.owed)}</span>
          </li>
        ))}
      </ul>
      {debtors.length > DEBTORS_SHOWN && (
        <Button variant="ghost" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? 'Ver menos' : `Ver los ${debtors.length}`}
        </Button>
      )}
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Recordar a los que deben
      </Button>
      <p className={styles.muted} aria-live="polite">
        {remind.isSuccess &&
          `Listo: se lo recordamos a ${remind.data.reminded === 1 ? '1 persona' : `${remind.data.reminded} personas`}.`}
      </p>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Recordarles que deben?">
        <div className={styles.sheetBody}>
          <p className={styles.note}>
            Le llega un aviso al celular {people}, si activaron los avisos: "Tienes cobros
            pendientes". Sin el valor; cuánto debe lo ve cada uno en Tus cuentas.
          </p>
          {remind.isError && (
            <p role="alert" className={styles.error}>
              No pudimos mandar el recordatorio. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button
            busy={remind.isPending}
            onClick={() => remind.mutate(undefined, { onSuccess: () => setConfirm(false) })}
          >
            Sí, recordarles
          </Button>
          <Button variant="ghost" disabled={remind.isPending} onClick={() => setConfirm(false)}>
            No
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

function ChargeRow({ teamId, charge }: { teamId: string; charge: ChargeSummary }) {
  const Glyph = KIND_ICON[charge.kind];
  const context = [chargeContext(charge), charge.dueOn && dueLine(charge.dueOn)]
    .filter(Boolean)
    .join(', ');
  const { marks, label } = summaryMarks(charge);
  return (
    <Row
      to={`/equipos/${teamId}/cobros/${charge.id}`}
      leading={
        <span className={styles.icon} aria-hidden="true">
          <Glyph size={22} />
        </span>
      }
      title={chargeTitle(charge)}
      meta={
        <span className={styles.metaLine}>
          {context && <span>{context}</span>}
          {charge.cancelled ? (
            <Badge tone="neutral" size="sm">
              Anulado
            </Badge>
          ) : (
            <>
              {charge.people > 1 && <VacaStrip marks={marks} label={label} size="sm" />}
              {charge.reported > 0 && (
                <Badge tone="brand" size="sm">
                  {charge.reported} por confirmar
                </Badge>
              )}
            </>
          )}
        </span>
      }
      trailing={
        <span className={styles.amount}>
          {pesos(charge.cancelled ? charge.balance.billed : charge.balance.pending)}
          <small>
            {charge.cancelled ? 'anulado' : charge.balance.pending ? 'falta' : 'completo'}
          </small>
        </span>
      }
    />
  );
}
