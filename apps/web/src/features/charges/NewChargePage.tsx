import { Check } from '@phosphor-icons/react/dist/csr/Check';
import type { ChargeKind, ChargeSplit } from '@sdl/contracts';
import { CHARGE_KIND_LABELS, splitTotal } from '@sdl/domain';
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { Segmented } from '../../shared/ui/Segmented';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { matchDay, matchTitle } from '../matches/match-view';
import { useMatch, useMatches, useTournaments } from '../matches/use-matches';
import { useTeamMembers } from '../team-roles/use-team-roles';
import { parsePesos, pesos } from './charge-view';
import { failure, MoneyField } from './ChargePage';
import styles from './Charges.module.css';
import { useCreateCharge } from './use-charges';

const KINDS = Object.entries(CHARGE_KIND_LABELS) as [ChargeKind, string][];
type Source = 'match' | 'tournament' | 'loose';
type Who = 'came' | 'all' | 'pick';

/** "Cobrarles también a los que dijeron voy y no vinieron" se recuerda (08 §7). */
const NO_SHOWS_KEY = 'sdl.charges.alsoNoShows';
function readNoShows(): boolean {
  try {
    return localStorage.getItem(NO_SHOWS_KEY) === '1';
  } catch {
    return false;
  }
}
function writeNoShows(value: boolean) {
  try {
    localStorage.setItem(NO_SHOWS_KEY, value ? '1' : '0');
  } catch {
    // Sin almacenamiento (ventana privada): se olvida, nada más.
  }
}

interface Person {
  id: string;
  name: string;
  jersey: number | null;
  /** Del partido: vino, o dijo voy y no vino. */
  came: boolean;
  noShow: boolean;
}

/**
 * /equipos/:teamId/cobros/nuevo[?partido=…] — crear un cobro en dos pasos (`06` Cobros): qué y
 * de qué; a quién y cuánto. Desde un partido arranca con los que vinieron ("¿Quién vino?").
 * Todo a mano: nada se cobra solo.
 */
export function NewChargePage({ teamId, fromMatch }: { teamId: string; fromMatch: string | null }) {
  const navigate = useNavigate();
  const id = useId();
  const create = useCreateCharge(teamId);
  const members = useTeamMembers(teamId);
  const matches = useMatches(teamId);
  const tournaments = useTournaments(teamId);

  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<ChargeKind>('vaca');
  const [source, setSource] = useState<Source>(fromMatch ? 'match' : 'loose');
  const [matchId, setMatchId] = useState(fromMatch ?? '');
  const [tournamentId, setTournamentId] = useState('');
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [who, setWho] = useState<Who>(fromMatch ? 'came' : 'all');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [noShows, setNoShows] = useState(readNoShows);
  const [split, setSplit] = useState<ChargeSplit>('total');
  const [amount, setAmount] = useState('');
  /** Patrocinios desde el comienzo: de quién es la parte → quién la asume (`'team'` o su id). */
  const [sponsors, setSponsors] = useState<ReadonlyMap<string, string>>(new Map());
  const [sponsoring, setSponsoring] = useState(false);

  const match = useMatch(teamId, source === 'match' && matchId ? matchId : null);
  const roster = match.data?.roster ?? null;
  const people: Person[] = useMemo(() => {
    const players = members.data?.players ?? [];
    const byId = new Map(roster?.map((r) => [r.playerId, r]));
    return players.map((p) => {
      const r = byId.get(p.userId);
      return {
        id: p.userId,
        name: p.displayName,
        jersey: p.jerseyNumber,
        came: r?.came ?? false,
        noShow: r ? !r.came && r.reply === 'yes' : false,
      };
    });
  }, [members.data, roster]);

  const fine = kind === 'fine';
  // Antes de la hora no hay lista: "los que vinieron" son los que dijeron voy (`whoCame`).
  const ahead = match.data?.match.open ?? false;
  const canUseCame = source === 'match' && roster !== null;
  const mode: Who = fine ? 'pick' : who === 'came' && !canUseCame ? 'all' : who;
  const chosen = useMemo(() => {
    if (mode === 'all') return new Set(people.map((p) => p.id));
    if (mode === 'came') {
      return new Set(people.filter((p) => p.came || (noShows && p.noShow)).map((p) => p.id));
    }
    return picked;
  }, [mode, people, noShows, picked]);
  const count = chosen.size;
  // Solo cuentan los de quienes siguen en el cobro.
  const activeSponsors = [...sponsors].filter(([userId]) => chosen.has(userId));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const value = parsePesos(amount);
  const effectiveSplit: ChargeSplit = fine ? 'per_person' : split;
  const dirty = step === 2 || title !== '' || amount !== '';
  const guard = useUnsavedChanges(dirty && !create.isSuccess);

  const recentMatches = (matches.data?.items ?? [])
    .filter((m) => m.status === 'scheduled')
    .slice(0, 20);

  // Tocar a alguien deja de seguir "los que vinieron" o "todos": se elige a mano desde ahí.
  const toggle = (personId: string) => {
    const base = fine ? new Set<string>() : new Set(chosen);
    if (base.has(personId)) base.delete(personId);
    else base.add(personId);
    setPicked(base);
    setWho('pick');
  };

  const stepOneReady =
    source === 'loose' || (source === 'match' ? matchId !== '' : tournamentId !== '');

  function submit() {
    if (!value || count === 0) return;
    create.mutate(
      {
        kind,
        title: title.trim() || null,
        matchId: source === 'match' ? matchId : null,
        tournamentId: source === 'tournament' ? tournamentId : null,
        split: effectiveSplit,
        amount: value,
        dueOn: dueOn || null,
        playerIds: [...chosen],
        sponsors: activeSponsors.map(([userId, sponsor]) => ({ userId, sponsor })),
      },
      {
        onSuccess: (data) => {
          guard.release();
          void navigate(`/equipos/${teamId}/cobros/${data.charge.id}`, { replace: true });
        },
      },
    );
  }

  const back = (
    <Link
      to={fromMatch ? `/equipos/${teamId}/partidos/${fromMatch}` : `/equipos/${teamId}/cobros`}
      className={styles.back}
    >
      {fromMatch ? 'Partido' : 'Cobros'}
    </Link>
  );

  if (step === 1) {
    return (
      <Screen className={styles.screen}>
        {guard.prompt}
        {back}
        <PageTitle eyebrow="Nuevo cobro" title="¿Qué se cobra?" />
        <span className={styles.step}>Paso 1 de 2</span>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (stepOneReady) setStep(2);
          }}
        >
          <fieldset className={styles.field}>
            <legend className={styles.label}>Tipo</legend>
            <div className={styles.options}>
              {KINDS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={styles.option}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className={styles.field}>
            <span className={styles.label} id={`${id}-de`}>
              De qué es
            </span>
            <Segmented
              label="De qué es"
              options={[
                { value: 'match', label: 'Un partido' },
                { value: 'tournament', label: 'Un torneo' },
                { value: 'loose', label: 'Suelto' },
              ]}
              value={source}
              onChange={setSource}
            />
          </div>

          {source === 'match' && (
            <div className={styles.field}>
              <label htmlFor={`${id}-partido`} className={styles.label}>
                El partido
              </label>
              <select
                id={`${id}-partido`}
                name="partido"
                className={styles.input}
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
              >
                <option value="">Elige el partido</option>
                {recentMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchTitle(m)}, {matchDay(m.startsAt)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {source === 'tournament' && (
            <div className={styles.field}>
              <label htmlFor={`${id}-torneo`} className={styles.label}>
                El torneo
              </label>
              <select
                id={`${id}-torneo`}
                name="torneo"
                className={styles.input}
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
              >
                <option value="">Elige el torneo</option>
                {(tournaments.data?.items ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor={`${id}-titulo`} className={styles.label}>
              Nombre (opcional)
            </label>
            <input
              id={`${id}-titulo`}
              name="titulo"
              className={styles.input}
              maxLength={80}
              autoComplete="off"
              placeholder={fine ? 'Amarilla contra Los Pibes…' : 'Uniformes nuevos…'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-vence`} className={styles.label}>
              Hasta cuándo (opcional)
            </label>
            <input
              id={`${id}-vence`}
              name="vence"
              type="date"
              className={styles.input}
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!stepOneReady}>
            Seguir
          </Button>
        </form>
      </Screen>
    );
  }

  const each = value && count > 0 ? splitTotal(value, count) : null;
  return (
    <Screen className={styles.screen}>
      {guard.prompt}
      <button type="button" className={styles.back} onClick={() => setStep(1)}>
        Paso anterior
      </button>
      <PageTitle
        eyebrow={title.trim() || CHARGE_KIND_LABELS[kind]}
        title={fine ? '¿A quién?' : '¿A quién se le cobra?'}
      />
      <span className={styles.step}>Paso 2 de 2</span>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!fine && (
          <Segmented
            label="A quién"
            options={[
              ...(canUseCame
                ? [{ value: 'came' as const, label: ahead ? 'Los que van' : 'Los que vinieron' }]
                : []),
              { value: 'all', label: 'Todos' },
              { value: 'pick', label: 'Elegir' },
            ]}
            value={mode}
            onChange={(value) => {
              if (value === 'pick') setPicked(new Set(chosen));
              setWho(value);
            }}
          />
        )}
        {fine && <p className={styles.note}>Una multa es de una sola persona.</p>}

        <ul className={styles.list} aria-label="Jugadores">
          {people.map((p) => (
            <li key={p.id}>
              <label className={styles.pickRow}>
                <Avatar
                  name={p.name}
                  label={p.jersey !== null ? String(p.jersey) : initialsOf(p.name)}
                  size={32}
                />
                <span className={styles.pickName}>
                  {p.name}
                  {canUseCame && (
                    <small>
                      {ahead
                        ? p.came
                          ? 'Va'
                          : 'No ha dicho que va'
                        : p.came
                          ? 'Vino'
                          : p.noShow
                            ? 'Dijo voy y no vino'
                            : 'No vino'}
                    </small>
                  )}
                </span>
                <input
                  type={fine ? 'radio' : 'checkbox'}
                  name="persona"
                  className={styles.pickInput}
                  checked={chosen.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className={styles.pickMark} aria-hidden="true">
                  <Check size={16} weight="bold" />
                </span>
              </label>
            </li>
          ))}
        </ul>
        {mode === 'came' && ahead && (
          <p className={styles.note}>
            Si alguien no va al final, le ajustas lo que debe en el cobro (mientras no haya pagado).
          </p>
        )}
        {mode === 'came' && !ahead && (
          <label className={styles.optIn}>
            <input
              type="checkbox"
              name="tambien-los-que-no-vinieron"
              checked={noShows}
              onChange={(e) => {
                setNoShows(e.target.checked);
                writeNoShows(e.target.checked);
              }}
            />
            Cobrarles también a los que dijeron voy y no vinieron
          </label>
        )}

        <section className={styles.field} aria-labelledby={`${id}-otro`}>
          <h2 className={styles.label} id={`${id}-otro`}>
            ¿A alguien se lo paga otro?
          </h2>
          {activeSponsors.length > 0 && (
            <ul className={styles.list}>
              {activeSponsors.map(([userId, sponsor]) => (
                <li key={userId} className={`${styles.pickRow} ${styles.still}`}>
                  <span className={styles.pickName}>
                    {nameOf.get(userId)}
                    <small>
                      {sponsor === 'team'
                        ? 'La cubre el equipo'
                        : `La paga ${nameOf.get(sponsor) ?? 'otro'}`}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={styles.quiet}
                    aria-label={`Quitar: ${nameOf.get(userId)} paga lo suyo`}
                    onClick={() => {
                      const next = new Map(sponsors);
                      next.delete(userId);
                      setSponsors(next);
                    }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={count === 0}
            onClick={() => setSponsoring(true)}
          >
            Lo paga otro
          </Button>
        </section>

        <div className={styles.field}>
          <span className={styles.label}>¿Cuánto?</span>
          {!fine && (
            <Segmented
              label="Cómo se cobra"
              options={[
                { value: 'total', label: 'Total que se reparte' },
                { value: 'per_person', label: 'Por persona' },
              ]}
              value={split}
              onChange={setSplit}
            />
          )}
        </div>
        <MoneyField
          id={`${id}-cuanto`}
          label={effectiveSplit === 'total' ? 'El total' : 'Cada uno'}
          value={amount}
          onChange={setAmount}
        />
        <p className={styles.note} aria-live="polite">
          {count === 0 ? (
            'Elige a quién se le cobra.'
          ) : !value ? (
            `${count} ${count === 1 ? 'persona' : 'personas'}.`
          ) : effectiveSplit === 'total' && each ? (
            <>
              Entre {count} {count === 1 ? 'persona' : 'personas'}: <b>{pesos(each.share)}</b> cada
              uno.
              {each.surplus > 0 && (
                <>
                  {' '}
                  Sobran <b>{pesos(each.surplus)}</b>.
                </>
              )}
            </>
          ) : (
            <>
              {count} {count === 1 ? 'persona' : 'personas'}: <b>{pesos(value * count)}</b> en
              total.
            </>
          )}
        </p>
        {create.isError && (
          <p role="alert" className={styles.error}>
            {failure(create.error, 'No pudimos crear el cobro. Revisa tu conexión.')}
          </p>
        )}
        <Button type="submit" busy={create.isPending} disabled={!value || count === 0}>
          Crear cobro
        </Button>
      </form>
      <Sheet open={sponsoring} onClose={() => setSponsoring(false)} title="Lo paga otro">
        {sponsoring && (
          <SponsorPicker
            people={people}
            whose={people.filter((p) => chosen.has(p.id) && !sponsors.has(p.id))}
            onPick={(userId, sponsor) => {
              setSponsors(new Map(sponsors).set(userId, sponsor));
              setSponsoring(false);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

/**
 * Elegir de quién es la parte y quién la asume: el equipo u otro jugador del equipo (aunque no
 * esté en el cobro). Quien la debía la ve cubierta, sin saber quién (`02` §15).
 */
function SponsorPicker({
  people,
  whose,
  onPick,
}: {
  people: Person[];
  whose: Person[];
  onPick: (userId: string, sponsor: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState<string | null>(null);
  const name = people.find((p) => p.id === userId)?.name;
  if (whose.length === 0) {
    return (
      <p className={styles.note}>
        A todos los del cobro ya se los paga otro. Quita uno para cambiarlo.
      </p>
    );
  }
  return (
    <div className={styles.sheetBody}>
      <fieldset className={styles.field}>
        <legend className={styles.label}>¿La parte de quién?</legend>
        <div className={styles.options}>
          {whose.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.option}
              aria-pressed={userId === p.id}
              onClick={() => {
                setUserId(p.id);
                if (sponsor === p.id) setSponsor(null);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.field} disabled={userId === null}>
        <legend className={styles.label}>¿Quién la paga?</legend>
        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            aria-pressed={sponsor === 'team'}
            onClick={() => setSponsor('team')}
          >
            El equipo
          </button>
          {people
            .filter((p) => p.id !== userId)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.option}
                aria-pressed={sponsor === p.id}
                onClick={() => setSponsor(p.id)}
              >
                {p.name}
              </button>
            ))}
        </div>
      </fieldset>
      <p className={styles.note}>
        {sponsor === 'team'
          ? 'Sale de la caja del equipo: no se le cobra a nadie.'
          : 'Esa persona la ve en sus cuentas y la paga como la suya.'}{' '}
        {name ?? 'Quien la debía'} la ve cubierta, sin saber quién.
      </p>
      <Button
        disabled={userId === null || sponsor === null}
        onClick={() => userId && sponsor && onPick(userId, sponsor)}
      >
        Listo
      </Button>
    </div>
  );
}
