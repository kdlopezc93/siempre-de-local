import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { Sheet } from '../../shared/ui/Sheet';
import switchStyles from '../../shared/ui/Switch.module.css';
import { useSession } from '../auth/use-session';
import { useTeam } from '../team-admin/use-invitations';
import { teamPeople, type TeamPerson } from './roles-view';
import styles from './TeamRolesPage.module.css';
import {
  useRemoveMember,
  useTeamMembers,
  useTransferCoach,
  useUpdateRoles,
} from './use-team-roles';

const failed = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

/**
 * /equipos/:teamId/roles — quién juega, quién es asistente y quién es tesorero, pasar el mando
 * de entrenador y quitar del equipo al que ya no viene (coach y admin del club; Kevin,
 * 2026-10-29). Alguien del cuerpo técnico también puede jugar, y el tesorero también (2026-10-30).
 */
export function TeamRolesPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const members = useTeamMembers(teamId);
  const back = (
    <Link to={`/equipos/${teamId}/equipo`} className={styles.back}>
      Equipo
    </Link>
  );
  if (team.isPending || members.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }
  const roles = team.data?.myRoles ?? [];
  // El admin del club entra sin roles en el equipo.
  const manages = roles.includes('coach') || (team.data !== undefined && roles.length === 0);
  if (!team.data || !members.data || !manages) {
    return (
      <Screen className={styles.screen}>
        {back}
        <PageTitle eyebrow="Equipo" title="Integrantes y roles" />
        <p role="alert" className={styles.lead}>
          {team.data && !manages
            ? 'Solo el entrenador y los administradores del club cambian los roles.'
            : 'No pudimos cargar el equipo. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }

  const people = teamPeople(members.data);
  const coach = people.find((p) => p.coach);
  return (
    <Screen className={styles.screen}>
      {back}
      <header>
        <PageTitle eyebrow={team.data.team.name} title="Integrantes y roles" />
        <p className={styles.lead}>
          Los asistentes valoran, puntúan y arman alineaciones. Quien es del cuerpo técnico también
          puede jugar.
        </p>
      </header>
      <CoachSection teamId={teamId} coach={coach} people={people} />
      <PeopleSection teamId={teamId} people={people} />
    </Screen>
  );
}

function CoachSection({
  teamId,
  coach,
  people,
}: {
  teamId: string;
  coach: TeamPerson | undefined;
  people: TeamPerson[];
}) {
  const session = useSession();
  const navigate = useNavigate();
  const transfer = useTransferCoach(teamId);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string | null>(null);
  const candidates = people.filter((p) => !p.coach);
  const chosen = candidates.find((p) => p.userId === to);
  const itsMe = coach !== undefined && coach.userId === session.data?.user.id;

  function confirm() {
    if (!chosen) return;
    transfer.mutate(chosen.userId, {
      onSuccess: () => {
        setOpen(false);
        // Quien pasó el mando ya no cambia roles: vuelve a Equipo.
        if (itsMe) void navigate(`/equipos/${teamId}/equipo`);
      },
    });
  }

  return (
    <section aria-labelledby="entrenador" className={styles.section}>
      <h2 id="entrenador" className={styles.sectionTitle}>
        Entrenador
      </h2>
      <div className={styles.coach}>
        {coach ? (
          <>
            <Avatar name={coach.displayName} shape="circle" />
            <span className={styles.name}>{coach.displayName}</span>
          </>
        ) : (
          <span className={styles.muted}>El equipo no tiene entrenador.</span>
        )}
      </div>
      {candidates.length > 0 && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {coach ? 'Pasar el mando' : 'Elegir entrenador'}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={coach ? '¿A quién le pasas el mando?' : '¿Quién es el entrenador?'}
      >
        <div className={styles.sheet}>
          <fieldset className={styles.choices}>
            <legend className="sr-only">Nuevo entrenador</legend>
            {candidates.map((p) => (
              <label key={p.userId} className={styles.choice}>
                <input
                  type="radio"
                  name="coach"
                  checked={to === p.userId}
                  onChange={() => setTo(p.userId)}
                />
                <Avatar name={p.displayName} shape="circle" size={32} />
                <span className={styles.name}>{p.displayName}</span>
              </label>
            ))}
          </fieldset>
          {coach && (
            <p className={styles.muted}>
              {itsMe ? 'Tú quedas' : `${coach.displayName} queda`} de asistente
              {coach.player ? (itsMe ? ' y sigues jugando' : ' y sigue jugando') : ''}.
            </p>
          )}
          {transfer.isError && (
            <p role="alert" className={styles.error}>
              {failed(transfer.error, 'No pudimos pasar el mando. Revisa tu conexión.')}
            </p>
          )}
          <Button busy={transfer.isPending} disabled={!chosen} onClick={confirm}>
            {chosen ? `Pasarle el mando a ${chosen.displayName}` : 'Elige a alguien'}
          </Button>
          <Button variant="ghost" disabled={transfer.isPending} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

function PeopleSection({ teamId, people }: { teamId: string; people: TeamPerson[] }) {
  const update = useUpdateRoles(teamId);
  const [removing, setRemoving] = useState<TeamPerson | null>(null);
  const pending = update.isPending ? update.variables : undefined;
  return (
    <section aria-labelledby="roles" className={styles.section}>
      <h2 id="roles" className={styles.sectionTitle}>
        Integrantes ({people.length})
      </h2>
      <p className={styles.muted}>
        Si es lo único que tiene, no se apaga: para sacar a alguien, usa «Quitar del equipo».
      </p>
      {update.isError && (
        <p role="alert" className={styles.error}>
          {failed(update.error, 'No pudimos cambiar el rol. Revisa tu conexión.')}
        </p>
      )}
      <ul className={styles.list}>
        {people.map((p) => {
          // Mientras se guarda, se ve como va a quedar.
          const patch = pending?.userId === p.userId ? pending.patch : undefined;
          const busy = patch !== undefined;
          const shown = {
            coach: p.coach,
            player: patch?.player ?? p.player,
            assistant: patch?.assistant ?? p.assistant,
            treasurer: patch?.treasurer ?? p.treasurer,
          };
          const roleCount = [shown.coach, shown.assistant, shown.player, shown.treasurer].filter(
            Boolean,
          ).length;
          return (
            <li key={p.userId} className={styles.person}>
              <div className={styles.personHead}>
                <Avatar
                  name={p.displayName}
                  label={p.jerseyNumber !== null ? String(p.jerseyNumber) : null}
                  size={40}
                />
                <span className={styles.name}>{p.displayName}</span>
                {p.coach && <Badge tone="brand">Entrenador</Badge>}
              </div>
              <div className={styles.toggles}>
                <RoleSwitch
                  label="Juega"
                  name={p.displayName}
                  checked={shown.player}
                  // Sin ningún rol saldría del equipo: eso es otra cosa.
                  disabled={busy || (shown.player && roleCount === 1)}
                  onChange={(player) => update.mutate({ userId: p.userId, patch: { player } })}
                />
                {!p.coach && (
                  <RoleSwitch
                    label="Asistente"
                    name={p.displayName}
                    checked={shown.assistant}
                    disabled={busy || (shown.assistant && roleCount === 1)}
                    onChange={(assistant) =>
                      update.mutate({ userId: p.userId, patch: { assistant } })
                    }
                  />
                )}
                {/* El entrenador ya maneja la plata (2026-10-30). */}
                {!p.coach && (
                  <RoleSwitch
                    label="Tesorero"
                    name={p.displayName}
                    checked={shown.treasurer}
                    disabled={busy || (shown.treasurer && roleCount === 1)}
                    onChange={(treasurer) =>
                      update.mutate({ userId: p.userId, patch: { treasurer } })
                    }
                  />
                )}
              </div>
              {!p.coach && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Quitar del equipo a ${p.displayName}`}
                  disabled={busy}
                  onClick={() => setRemoving(p)}
                >
                  Quitar del equipo
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <RemoveSheet teamId={teamId} person={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}

/** Confirmar antes de quitar: deja de ver el equipo, pero lo suyo queda. */
function RemoveSheet({
  teamId,
  person,
  onClose,
}: {
  teamId: string;
  person: TeamPerson | null;
  onClose: () => void;
}) {
  const remove = useRemoveMember(teamId);
  // Al cerrar, la hoja sigue mostrando a quién mientras baja.
  const [shown, setShown] = useState(person);
  if (person && person !== shown) setShown(person);
  const name = shown?.displayName ?? '';
  return (
    <Sheet open={person !== null} onClose={onClose} title={`¿Quitar a ${name} del equipo?`}>
      <div className={styles.sheet}>
        <p className={styles.sheetText}>
          Deja de ver el equipo y de contar en la plantilla, las convocatorias y las alineaciones.
          Lo suyo queda guardado: si vuelve, lo invitas de nuevo y recupera su dorsal.
        </p>
        {remove.isError && (
          <p role="alert" className={styles.error}>
            {failed(remove.error, 'No pudimos quitarlo. Revisa tu conexión.')}
          </p>
        )}
        <Button
          variant="danger"
          busy={remove.isPending}
          onClick={() => shown && remove.mutate(shown.userId, { onSuccess: onClose })}
        >
          Sí, quitar a {name}
        </Button>
        <Button variant="ghost" disabled={remove.isPending} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}

function RoleSwitch({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        role="switch"
        className={switchStyles.switch}
        aria-label={`${label}: ${name}`}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true">{label}</span>
    </label>
  );
}
