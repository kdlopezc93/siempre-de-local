import type { ClubResponse } from '@sdl/contracts';
import { useId, useState, type FormEvent } from 'react';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Sheet } from '../../shared/ui/Sheet';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { Token } from '../../shared/ui/Token';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { FORMAT_LABEL } from '../shell/shell-nav';
import styles from './ClubPage.module.css';
import { useArchiveTeam, useClub, useClubAdmin, useUpdateClub } from './use-club';

/** A quién deja de vérsele el equipo al archivarlo. */
function archivedFor(members: number): string {
  if (members === 0) return 'No tiene integrantes';
  if (members === 1) return 'Deja de verse para su único integrante';
  return `Deja de verse para sus ${members} integrantes`;
}

/** Hasta 3 equipos activos por club (como el API). */
const TEAMS_PER_CLUB = 3;

/**
 * /clubes/:clubId — el club (Kevin, 2026-10-29): sus datos (nombre y ciudad o barrio) y sus
 * equipos. Para el dueño y los admins del club.
 */
export function ClubPage({ me, clubId }: { me: Me; clubId: string }) {
  const club = useClub(clubId);
  if (club.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el club…
        </p>
      </Screen>
    );
  }
  if (!club.data) {
    const forbidden = club.error instanceof ApiError && club.error.status === 403;
    return (
      <Screen className={styles.screen}>
        <PageTitle eyebrow="Club" title="Tu club" />
        <p role="alert" className={styles.lead}>
          {forbidden
            ? 'Solo el dueño y los admins del club lo manejan.'
            : 'No pudimos cargar el club. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  const { club: data, teams, admins, candidates, myRole } = club.data;
  return (
    <Screen className={styles.screen}>
      <header>
        <PageTitle eyebrow="Club" title={data.name} subtitle={data.city ?? undefined} />
      </header>
      <ClubData clubId={clubId} club={data} />
      <ClubTeams me={me} clubId={clubId} teams={teams} />
      <ClubAdmins
        clubId={clubId}
        admins={admins}
        candidates={candidates}
        isOwner={myRole === 'owner'}
      />
    </Screen>
  );
}

function ClubData({ clubId, club }: { clubId: string; club: ClubResponse['club'] }) {
  const [editing, setEditing] = useState(false);
  return (
    <section aria-labelledby="datos-club" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="datos-club" className={styles.sectionTitle}>
          Datos del club
        </h2>
        {!editing && (
          <button type="button" className={styles.textButton} onClick={() => setEditing(true)}>
            Editar
          </button>
        )}
      </div>
      {editing ? (
        <ClubForm clubId={clubId} club={club} onDone={() => setEditing(false)} />
      ) : (
        <dl className={styles.facts}>
          <div>
            <dt>Nombre</dt>
            <dd>{club.name}</dd>
          </div>
          <div>
            <dt>Ciudad o barrio</dt>
            <dd>{club.city ?? 'Sin ciudad todavía'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function ClubForm({
  clubId,
  club,
  onDone,
}: {
  clubId: string;
  club: ClubResponse['club'];
  onDone: () => void;
}) {
  const update = useUpdateClub(clubId);
  const [name, setName] = useState(club.name);
  const [city, setCity] = useState(club.city ?? '');
  const [invalid, setInvalid] = useState<string | null>(null);
  const nameId = useId();
  const cityId = useId();
  const guard = useUnsavedChanges(name !== club.name || city !== (club.city ?? ''));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return setInvalid('Escribe el nombre del club.');
    if (city.trim().length < 2) return setInvalid('Escribe la ciudad o el barrio.');
    setInvalid(null);
    update.mutate(
      { name: name.trim(), city: city.trim() },
      {
        onSuccess: () => {
          guard.release();
          onDone();
        },
      },
    );
  }

  const error =
    invalid ??
    (update.error instanceof ApiError && update.error.status < 500
      ? update.error.message
      : update.isError
        ? 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'
        : null);

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {guard.prompt}
      <label htmlFor={nameId} className={styles.label}>
        Nombre
      </label>
      <input
        id={nameId}
        className={styles.input}
        value={name}
        maxLength={60}
        autoComplete="organization"
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor={cityId} className={styles.label}>
        Ciudad o barrio
      </label>
      <input
        id={cityId}
        className={styles.input}
        value={city}
        maxLength={60}
        autoComplete="address-level2"
        placeholder="Ej.: Bosa, Bogotá"
        onChange={(event) => setCity(event.target.value)}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" busy={update.isPending}>
          Guardar
        </Button>
        <Button variant="ghost" disabled={update.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ClubTeams({
  me,
  clubId,
  teams,
}: {
  me: Me;
  clubId: string;
  teams: ClubResponse['teams'];
}) {
  const active = teams.filter((t) => !t.archived);
  const mine = new Set(me.teams.map((t) => t.team.id));
  const archive = useArchiveTeam(clubId);
  const [archiving, setArchiving] = useState<ClubResponse['teams'][number] | null>(null);
  // Al cerrar, la hoja sigue mostrando cuál mientras baja.
  const [shown, setShown] = useState(archiving);
  if (archiving && archiving !== shown) setShown(archiving);
  const pending = archive.isPending ? archive.variables.teamId : null;
  return (
    <section aria-labelledby="equipos-club" className={styles.section}>
      <h2 id="equipos-club" className={styles.sectionTitle}>
        Equipos ({active.length} de {TEAMS_PER_CLUB})
      </h2>
      {archive.isError && !archiving && (
        <p role="alert" className={styles.error}>
          {archive.error instanceof ApiError && archive.error.status < 500
            ? archive.error.message
            : 'No pudimos cambiarlo. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
      <ul className={styles.list}>
        {teams.map((t) => (
          <li key={t.id} className={styles.teamItem}>
            <Row
              // Solo abre los equipos donde estás: el encabezado de la app es de esos.
              {...(mine.has(t.id) ? { to: `/equipos/${t.id}/equipo` } : {})}
              leading={<Token text={initialsOf(t.name)} tone="brand" size="sm" />}
              title={t.name}
              meta={[
                FORMAT_LABEL[t.format],
                t.category,
                t.season,
                t.members === 1 ? '1 persona' : `${t.members} personas`,
                t.archived && 'Archivado',
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <button
              type="button"
              className={styles.teamAction}
              aria-label={`${t.archived ? 'Desarchivar' : 'Archivar'} ${t.name}`}
              disabled={pending === t.id}
              onClick={() =>
                t.archived ? archive.mutate({ teamId: t.id, archived: false }) : setArchiving(t)
              }
            >
              {t.archived ? 'Desarchivar' : 'Archivar'}
            </button>
          </li>
        ))}
      </ul>
      <Sheet
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title={`¿Archivar ${shown?.name ?? ''}?`}
      >
        <div className={styles.sheet}>
          <p className={styles.muted}>
            {archivedFor(shown?.members ?? 0)}. Libera un cupo del club y sus datos quedan
            guardados: lo puedes desarchivar desde aquí.
          </p>
          {archive.isError && (
            <p role="alert" className={styles.error}>
              No pudimos archivarlo. Revisa tu conexión e intenta de nuevo.
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
      {active.length < TEAMS_PER_CLUB ? (
        <ButtonLink to={`/clubes/${clubId}/nuevo-equipo`} variant="secondary">
          Nuevo equipo
        </ButtonLink>
      ) : (
        <p className={styles.muted}>
          El club ya tiene {TEAMS_PER_CLUB} equipos. Para abrir otro, escríbenos.
        </p>
      )}
    </section>
  );
}

/**
 * El dueño y los admins (Kevin, 2026-10-29). El dueño nombra admins entre los integrantes de los
 * equipos del club y los quita; al dueño no se le quita.
 */
function ClubAdmins({
  clubId,
  admins,
  candidates,
  isOwner,
}: {
  clubId: string;
  admins: ClubResponse['admins'];
  candidates: ClubResponse['candidates'];
  isOwner: boolean;
}) {
  const change = useClubAdmin(clubId);
  const [adding, setAdding] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ClubResponse['admins'][number] | null>(null);
  const [shownRemoving, setShownRemoving] = useState(removing);
  if (removing && removing !== shownRemoving) setShownRemoving(removing);
  const pick = candidates.find((c) => c.userId === chosen);
  const failed =
    change.error instanceof ApiError && change.error.status < 500
      ? change.error.message
      : 'No pudimos guardarlo. Revisa tu conexión e intenta de nuevo.';

  return (
    <section aria-labelledby="admins-club" className={styles.section}>
      <h2 id="admins-club" className={styles.sectionTitle}>
        Admins del club
      </h2>
      <p className={styles.muted}>
        Ven todos los equipos del club, invitan entrenadores, crean y archivan equipos y editan el
        club. No valoran ni puntúan jugadores.
      </p>
      <ul className={styles.list}>
        {admins.map((a) => (
          <li key={a.userId} className={styles.admin}>
            <Avatar name={a.name} shape="circle" size={40} />
            <span className={styles.adminName}>{a.name}</span>
            {a.role === 'owner' ? (
              <Badge tone="brand">Dueño</Badge>
            ) : isOwner ? (
              <button
                type="button"
                className={styles.teamAction}
                aria-label={`Quitar admin a ${a.name}`}
                onClick={() => setRemoving(a)}
              >
                Quitar
              </button>
            ) : (
              <Badge tone="neutral">Admin</Badge>
            )}
          </li>
        ))}
      </ul>
      {isOwner &&
        (candidates.length > 0 ? (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Nombrar admin
          </Button>
        ) : (
          <p className={styles.muted}>
            Para nombrar admin a alguien, primero tiene que estar en algún equipo del club.
          </p>
        ))}

      <Sheet open={adding} onClose={() => setAdding(false)} title="¿A quién nombras admin?">
        <div className={styles.sheet}>
          <fieldset className={styles.choices}>
            <legend className="sr-only">Nuevo admin</legend>
            {candidates.map((c) => (
              <label key={c.userId} className={styles.choice}>
                <input
                  type="radio"
                  name="admin"
                  checked={chosen === c.userId}
                  onChange={() => setChosen(c.userId)}
                />
                <Avatar name={c.name} shape="circle" size={32} />
                <span className={styles.adminName}>{c.name}</span>
              </label>
            ))}
          </fieldset>
          {change.isError && adding && (
            <p role="alert" className={styles.error}>
              {failed}
            </p>
          )}
          <Button
            busy={change.isPending}
            disabled={!pick}
            onClick={() =>
              pick &&
              change.mutate(
                { userId: pick.userId, admin: true },
                {
                  onSuccess: () => {
                    setAdding(false);
                    setChosen(null);
                  },
                },
              )
            }
          >
            {pick ? `Nombrar admin a ${pick.name}` : 'Elige a alguien'}
          </Button>
          <Button variant="ghost" disabled={change.isPending} onClick={() => setAdding(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`¿Quitarle lo de admin a ${shownRemoving?.name ?? ''}?`}
      >
        <div className={styles.sheet}>
          <p className={styles.muted}>
            Sigue en sus equipos con sus roles; solo deja de manejar el club.
          </p>
          {change.isError && removing && (
            <p role="alert" className={styles.error}>
              {failed}
            </p>
          )}
          <Button
            variant="danger"
            busy={change.isPending}
            onClick={() =>
              shownRemoving &&
              change.mutate(
                { userId: shownRemoving.userId, admin: false },
                { onSuccess: () => setRemoving(null) },
              )
            }
          >
            Sí, quitar
          </Button>
          <Button variant="ghost" disabled={change.isPending} onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
