import type { ClubResponse } from '@sdl/contracts';
import { categoryKey, formatBirthYears, groupByCategory, groupLabel, yearStrip } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Sheet } from '../../shared/ui/Sheet';
import { FORMAT_LABEL } from '../shell/shell-nav';
import styles from './SchoolSections.module.css';
import { useArchiveTeam, useVenue } from './use-club';

type Team = ClubResponse['teams'][number];
type Venue = ClubResponse['venues'][number];

const people = (n: number) => (n === 1 ? '1 persona' : `${n} personas`);
const failed = (error: unknown) =>
  error instanceof ApiError && error.status < 500
    ? error.message
    : 'No pudimos guardarlo. Revisa tu conexión e intenta de nuevo.';

/**
 * Una escuela (Kevin, 2026-11-07, `08` §10): categorías por edad y, dentro de cada una, sus
 * grupos (masculino, femenino, mixto, A/B). Cada grupo es un equipo; aquí se juntan por
 * categoría y años (`02` §17).
 */
export function SchoolTeams({
  me,
  clubId,
  teams,
  teamsLimit,
}: {
  me: Me;
  clubId: string;
  teams: Team[];
  teamsLimit: number;
}) {
  const active = teams.filter((t) => !t.archived);
  const archived = teams.filter((t) => t.archived);
  const mine = new Set(me.teams.map((t) => t.team.id));
  const categories = groupByCategory(active);
  const mineKeys = new Set(
    categories
      .filter((c) => c.groups.some((g) => mine.has(g.id)))
      .map((c) => categoryKey(c.category)),
  );
  const archive = useArchiveTeam(clubId);
  const [archiving, setArchiving] = useState<Team | null>(null);
  const [shown, setShown] = useState(archiving);
  if (archiving && archiving !== shown) setShown(archiving);
  const pending = archive.isPending ? archive.variables.teamId : null;

  return (
    <>
      {categories.length > 0 && <YearStrip categories={categories} mineKeys={mineKeys} />}
      <section aria-labelledby="categorias" className={styles.section}>
        <h2 id="categorias" className={styles.sectionTitle}>
          Categorías{' '}
          <span className={styles.count}>
            {active.length === 1 ? '1 grupo' : `${active.length} grupos`} de {teamsLimit}
          </span>
        </h2>
        {archive.isError && !archiving && (
          <p role="alert" className={styles.error}>
            {failed(archive.error)}
          </p>
        )}
        {categories.length === 0 && (
          <p className={styles.muted}>Todavía no hay grupos activos. Abre el primero.</p>
        )}
        {categories.map((c) => (
          <article
            key={categoryKey(c.category)}
            aria-labelledby={`cat-${categoryKey(c.category)}`}
            className={styles.category}
            data-mine={mineKeys.has(categoryKey(c.category)) || undefined}
          >
            <header className={styles.categoryHead}>
              <h3 id={`cat-${categoryKey(c.category)}`} className={styles.categoryName}>
                {c.category}
              </h3>
              <span className={styles.years}>{formatBirthYears(c.years)}</span>
            </header>
            <ul className={styles.groups}>
              {c.groups.map((g) => (
                <li key={g.id} className={styles.group}>
                  <GroupLink team={g} category={c.category} mine={mine.has(g.id)} />
                  <button
                    type="button"
                    className={styles.groupAction}
                    aria-label={`Archivar ${g.name}`}
                    disabled={pending === g.id}
                    onClick={() => setArchiving(g)}
                  >
                    Archivar
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {active.length < teamsLimit ? (
          <ButtonLink to={`/clubes/${clubId}/nuevo-equipo`} variant="secondary">
            Nuevo grupo
          </ButtonLink>
        ) : (
          <p className={styles.muted}>
            La escuela ya tiene {teamsLimit} grupos. Para abrir otro, escríbenos.
          </p>
        )}
        {archived.length > 0 && (
          <details className={styles.archived}>
            <summary>Archivados ({archived.length})</summary>
            <ul className={styles.groups}>
              {archived.map((g) => (
                <li key={g.id} className={styles.group}>
                  <span className={styles.groupText}>
                    <span className={styles.groupName}>{g.name}</span>
                    <span className={styles.meta}>
                      {g.birthYears ? formatBirthYears(g.birthYears) : 'Sin años'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.groupAction}
                    aria-label={`Desarchivar ${g.name}`}
                    disabled={pending === g.id}
                    onClick={() => archive.mutate({ teamId: g.id, archived: false })}
                  >
                    Desarchivar
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <Sheet
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title={`¿Archivar ${shown?.name ?? ''}?`}
      >
        <div className={styles.sheet}>
          <p className={styles.muted}>
            Deja de verse para sus integrantes y libera un cupo. Sus datos quedan guardados: lo
            puedes desarchivar desde aquí.
          </p>
          {archive.isError && (
            <p role="alert" className={styles.error}>
              {failed(archive.error)}
            </p>
          )}
          <Button
            variant="danger"
            busy={archive.isPending}
            onClick={() =>
              shown &&
              archive.mutate(
                { teamId: shown.id, archived: true },
                { onSuccess: () => setArchiving(null) },
              )
            }
          >
            Sí, archivar
          </Button>
          <Button variant="ghost" disabled={archive.isPending} onClick={() => setArchiving(null)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function GroupLink({ team, category, mine }: { team: Team; category: string; mine: boolean }) {
  const label = groupLabel(team.name, category, team.gender);
  const meta = [FORMAT_LABEL[team.format], team.venue?.name, people(team.members)]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <span className={styles.groupName}>
        {label}
        {mine && (
          <Badge tone="accent" size="sm">
            Tu grupo
          </Badge>
        )}
      </span>
      <span className={styles.meta}>{meta}</span>
    </>
  );
  // Solo abre los grupos donde estás: el encabezado de la app es de esos.
  return mine ? (
    <Link to={`/equipos/${team.id}/equipo`} className={styles.groupText}>
      {body}
    </Link>
  ) : (
    <span className={styles.groupText}>{body}</span>
  );
}

/** "Quiénes caben hoy": la franja de años, una columna por año y los huecos punteados. */
function YearStrip({
  categories,
  mineKeys,
}: {
  categories: ReturnType<typeof groupByCategory<Team>>;
  mineKeys: Set<string>;
}) {
  const segments = yearStrip(categories);
  // Un hueco largo (de Veteranos a Sub-14) ocupa a lo sumo dos columnas: la franja no se estira.
  const width = (s: (typeof segments)[number]) => (s.kind === 'gap' ? Math.min(s.span, 2) : s.span);
  const columns = segments.reduce((n, s) => n + width(s), 0);
  const groupsOf = new Map(categories.map((c) => [categoryKey(c.category), c.groups]));
  const summary = segments
    .map((s) =>
      s.kind === 'gap'
        ? `${formatBirthYears(s)} sin categoría`
        : `${s.category}, ${formatBirthYears(s)}: ${gendersOf(groupsOf.get(categoryKey(s.category)) ?? [])}`,
    )
    .join('. ');
  return (
    <section aria-labelledby="quienes-caben" className={styles.strip}>
      <div className={styles.stripHead}>
        <h2 id="quienes-caben" className={styles.stripTitle}>
          Quiénes caben hoy
        </h2>
        <p className={styles.stripHint}>por año de nacimiento</p>
      </div>
      <div
        role="img"
        aria-label={summary}
        className={styles.stripGrid}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {segments.map((s) =>
          s.kind === 'gap' ? (
            <div
              key={`gap-${s.from}`}
              className={styles.gap}
              style={{ gridColumn: `span ${width(s)}` }}
            >
              {s.span > 2 && <span className={styles.gapYears}>{formatBirthYears(s)}</span>}
            </div>
          ) : (
            <div
              key={s.category}
              className={styles.block}
              data-mine={mineKeys.has(categoryKey(s.category)) || undefined}
              style={{ gridColumn: `span ${s.span}` }}
            >
              <span className={styles.blockName}>{s.category}</span>
              {s.span > 1 && (
                <span className={styles.blockGroups}>
                  {gendersOf(groupsOf.get(categoryKey(s.category)) ?? [], true)}
                </span>
              )}
            </div>
          ),
        )}
        {segments.flatMap((s) =>
          s.kind === 'gap' && s.span > 2
            ? [<span key={`gap-${s.from}`} style={{ gridColumn: 'span 2' }} />]
            : s.from === null
              ? [
                  <span key="open" className={styles.year}>
                    ≤{String(s.to).slice(2)}
                  </span>,
                ]
              : Array.from({ length: s.to - s.from + 1 }, (_, i) => (
                  <span key={s.from! + i} className={styles.year}>
                    {String(s.from! + i).slice(2)}
                  </span>
                )),
        )}
      </div>
      <p className={styles.stripHint}>
        Lo punteado son años sin categoría. En volt, donde entrenas tú.
      </p>
    </section>
  );
}

/** "Masc ×2 · Fem" (corto, en la franja) o "dos masculinos y un femenino" (para el lector). */
function gendersOf(groups: Team[], short = false): string {
  const count = { male: 0, female: 0, mixed: 0 };
  for (const g of groups) if (g.gender) count[g.gender] += 1;
  const names = short
    ? { male: 'Masc', female: 'Fem', mixed: 'Mixto' }
    : { male: 'masculino', female: 'femenino', mixed: 'mixto' };
  return (['male', 'female', 'mixed'] as const)
    .filter((k) => count[k] > 0)
    .map((k) => (count[k] > 1 ? `${names[k]} ×${count[k]}` : names[k]))
    .join(short ? ' · ' : ', ');
}

/** Las sedes de la escuela: agregar, cambiar y borrar (sus grupos quedan sin sede). */
export function SchoolVenues({ clubId, venues }: { clubId: string; venues: Venue[] }) {
  const [editing, setEditing] = useState<Venue | 'new' | null>(null);
  const [shown, setShown] = useState(editing);
  if (editing && editing !== shown) setShown(editing);
  return (
    <section aria-labelledby="sedes" className={styles.section}>
      <h2 id="sedes" className={styles.sectionTitle}>
        Sedes
      </h2>
      {venues.length === 0 ? (
        <p className={styles.muted}>Agrega dónde entrenan tus grupos.</p>
      ) : (
        <ul className={styles.venues}>
          {venues.map((v) => (
            <li key={v.id} className={styles.venue}>
              <span className={styles.groupText}>
                <span className={styles.groupName}>{v.name}</span>
                <span className={styles.meta}>
                  {[v.address ?? 'Sin dirección', v.teams === 1 ? '1 grupo' : `${v.teams} grupos`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <button
                type="button"
                className={styles.textButton}
                aria-label={`Editar ${v.name}`}
                onClick={() => setEditing(v)}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" onClick={() => setEditing('new')}>
        Agregar sede
      </Button>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={shown === 'new' || shown === null ? 'Agregar sede' : `Editar ${shown.name}`}
      >
        {shown !== null && (
          <VenueForm
            key={shown === 'new' ? 'new' : shown.id}
            clubId={clubId}
            venue={shown === 'new' ? null : shown}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </section>
  );
}

function VenueForm({
  clubId,
  venue,
  onDone,
}: {
  clubId: string;
  venue: Venue | null;
  onDone: () => void;
}) {
  const change = useVenue(clubId);
  const [name, setName] = useState(venue?.name ?? '');
  const [address, setAddress] = useState(venue?.address ?? '');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { name: useId(), address: useId() };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return setInvalid('Escribe el nombre de la sede.');
    setInvalid(null);
    const data = { name: name.trim(), address: address.trim() || null };
    change.mutate(
      venue
        ? { action: 'update', venueId: venue.id, venue: data }
        : { action: 'create', venue: data },
      { onSuccess: onDone },
    );
  }

  const error = invalid ?? (change.isError ? failed(change.error) : null);
  return (
    <form className={styles.sheet} onSubmit={submit} noValidate>
      <p className={styles.muted}>Donde entrenan tus grupos.</p>
      <label htmlFor={ids.name} className={styles.label}>
        Nombre
      </label>
      <input
        id={ids.name}
        className={styles.input}
        value={name}
        maxLength={60}
        autoComplete="off"
        placeholder="Ej.: El Tunal"
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor={ids.address} className={styles.label}>
        Dirección o referencia <span className={styles.optional}>(opcional)</span>
      </label>
      <input
        id={ids.address}
        className={styles.input}
        value={address}
        maxLength={120}
        autoComplete="off"
        placeholder="Ej.: Parque Timiza, cancha sintética"
        onChange={(event) => setAddress(event.target.value)}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" busy={change.isPending && change.variables?.action !== 'delete'}>
        Guardar sede
      </Button>
      {venue &&
        (confirmDelete ? (
          <Button
            variant="danger"
            busy={change.isPending && change.variables?.action === 'delete'}
            onClick={() =>
              change.mutate({ action: 'delete', venueId: venue.id }, { onSuccess: onDone })
            }
          >
            Sí, borrar {venue.name}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Borrar sede
          </Button>
        ))}
      {confirmDelete && (
        <p className={styles.muted}>
          {venue && venue.teams > 0
            ? venue.teams === 1
              ? 'Su grupo queda sin sede; no se borra nada más.'
              : `Sus ${venue.teams} grupos quedan sin sede; no se borra nada más.`
            : 'No la usa ningún grupo.'}
        </p>
      )}
      <Button variant="ghost" disabled={change.isPending} onClick={onDone}>
        Cancelar
      </Button>
    </form>
  );
}
