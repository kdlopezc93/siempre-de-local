import type { CreateInvitationResponse, InvitationSummary, TeamResponse } from '@sdl/contracts';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import styles from './InvitePage.module.css';
import {
  INVITE_KINDS,
  invitationLabel,
  invitationMessage,
  invitationRequest,
  type InviteKind,
  useCopy,
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
  useTeam,
  whatsappUrl,
} from './use-invitations';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Segmented } from '../../shared/ui/Segmented';
import switchStyles from '../../shared/ui/Switch.module.css';
import { useSession } from '../auth/use-session';

/**
 * /equipos/:teamId/invitar — el entrenador crea el enlace y lo manda al grupo. También invita
 * al cuerpo técnico (asistentes; entrenador, solo el admin del club), que puede también jugar.
 */
export function InvitePage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const invitations = useInvitations(teamId);
  const create = useCreateInvitation(teamId);
  const session = useSession();
  const [kind, setKind] = useState<InviteKind>('player');
  const [alsoPlays, setAlsoPlays] = useState(true);

  if (team.isPending || invitations.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando…
        </p>
      </Screen>
    );
  }

  const forbidden = [team.error, invitations.error].some(
    (error) => error instanceof ApiError && (error.status === 403 || error.status === 404),
  );
  if (team.isError || invitations.isError) {
    return (
      <Screen className={styles.screen}>
        <BackLink teamId={teamId} />
        <PageTitle eyebrow="Invita a" title="tu equipo" />
        <p role="alert" className={styles.lead}>
          {forbidden
            ? 'Solo el entrenador y los administradores del club pueden invitar a este equipo.'
            : 'No pudimos cargar el equipo. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }

  // Entrenador, solo el admin del club (04 §2.2).
  const clubAdmin = session.data?.clubs.some((c) => c.id === team.data.team.club.id) ?? false;
  const kinds: InviteKind[] = clubAdmin
    ? ['player', 'assistant', 'coach']
    : ['player', 'assistant'];

  return (
    <Screen className={styles.screen}>
      <BackLink teamId={teamId} />
      <header className={styles.header}>
        <PageTitle eyebrow="Invita a" title="tu equipo" />
        <p className={styles.lead}>
          {team.data.team.name}, de {team.data.team.club.name}
        </p>
      </header>

      {create.isSuccess ? (
        <FreshLink team={team.data.team} created={create.data} onAnother={() => create.reset()} />
      ) : (
        <section className={styles.create} aria-labelledby="create-title">
          <h2 id="create-title" className="sr-only">
            Crear enlace
          </h2>
          <InviteKindPicker
            kinds={kinds}
            kind={kind}
            onKind={setKind}
            alsoPlays={alsoPlays}
            onAlsoPlays={setAlsoPlays}
          />
          <p>
            {kind === 'player'
              ? 'Crea un enlace y mándalo al grupo del equipo. '
              : 'Crea un enlace solo para esa persona y mándaselo. '}
            {INVITE_KINDS[kind].what}
          </p>
          {create.isError && (
            <p role="alert" className={styles.alert}>
              No pudimos crear el enlace. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button
            busy={create.isPending}
            onClick={() => create.mutate(invitationRequest(kind, alsoPlays))}
          >
            {create.isPending ? 'Creando…' : 'Crear enlace'}
          </Button>
        </section>
      )}

      <InvitationList teamId={teamId} items={invitations.data.items} />
    </Screen>
  );
}

/** Jugadores (al grupo) o alguien del cuerpo técnico, que puede también jugar. */
function InviteKindPicker({
  kinds,
  kind,
  onKind,
  alsoPlays,
  onAlsoPlays,
}: {
  kinds: InviteKind[];
  kind: InviteKind;
  onKind: (kind: InviteKind) => void;
  alsoPlays: boolean;
  onAlsoPlays: (alsoPlays: boolean) => void;
}) {
  return (
    <div className={styles.kind}>
      <Segmented
        label="A quién invitas"
        options={kinds.map((k) => ({ value: k, label: INVITE_KINDS[k].label }))}
        value={kind}
        onChange={onKind}
      />
      {kind !== 'player' && (
        <label className={styles.alsoPlays}>
          <input
            type="checkbox"
            role="switch"
            className={switchStyles.switch}
            checked={alsoPlays}
            onChange={(event) => onAlsoPlays(event.target.checked)}
          />
          <span>
            También juega en el equipo
            <span className={styles.muted}>
              {alsoPlays ? 'Entra al cuerpo técnico y a la plantilla.' : 'Solo al cuerpo técnico.'}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

function BackLink({ teamId }: { teamId: string }) {
  return (
    <Link to={`/equipos/${teamId}/equipo`} className={styles.back}>
      Equipo
    </Link>
  );
}

/** El enlace recién creado: es la única vez que se puede ver (en la BD queda su hash). */
function FreshLink({
  team,
  created,
  onAnother,
}: {
  team: TeamResponse['team'];
  created: CreateInvitationResponse;
  onAnother: () => void;
}) {
  const { copied, copy } = useCopy();
  const [copyFailed, setCopyFailed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const message = invitationMessage(team, created.joinUrl, created.invitation.role);

  // El botón "Crear enlace" desaparece: el foco pasa al enlace recién creado.
  useEffect(() => titleRef.current?.focus(), []);
  const canShare = typeof navigator.share === 'function';

  return (
    <section className={styles.ticket} aria-labelledby="ticket-title">
      <h2 id="ticket-title" ref={titleRef} tabIndex={-1} className={styles.ticketTitle}>
        Tu enlace está listo
      </h2>
      <p
        className={styles.code}
        translate="no"
        aria-label={`Código ${created.code.split('').join(' ')}`}
      >
        {created.code.slice(0, 5)}
        <span className={styles.codeGap} aria-hidden="true" />
        {created.code.slice(5)}
      </p>
      <p className={styles.url} translate="no">
        {created.joinUrl}
      </p>

      <div className={styles.actions}>
        <a
          className={styles.whatsapp}
          href={whatsappUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Compartir por WhatsApp
        </a>
        <Button variant="secondary" onClick={async () => setCopyFailed(!(await copy(message)))}>
          {copied ? 'Copiado' : 'Copiar enlace'}
        </Button>
        {canShare && (
          <Button
            variant="ghost"
            onClick={() =>
              void navigator.share({ title: `Únete a ${team.name}`, text: message }).catch(() => {})
            }
          >
            Más formas de compartir
          </Button>
        )}
        <p className="sr-only" aria-live="polite">
          {copied ? 'Enlace copiado' : ''}
        </p>
        {copyFailed && (
          <p role="alert" className={styles.alert}>
            Tu navegador no dejó copiar. Mantén presionado el enlace de arriba para copiarlo.
          </p>
        )}
      </div>

      <p className={styles.note}>
        Guárdalo ahora: por seguridad no lo volvemos a mostrar. Si lo pierdes, crea otro.
      </p>
      <Button variant="ghost" onClick={onAnother}>
        Crear otro enlace
      </Button>
    </section>
  );
}

const STATUS: Record<InvitationSummary['status'], { label: string; tone: BadgeTone }> = {
  active: { label: 'Activo', tone: 'success' },
  expired: { label: 'Vencido', tone: 'danger' },
  used_up: { label: 'Completo', tone: 'neutral' },
  revoked: { label: 'Anulado', tone: 'neutral' },
};

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });

function InvitationList({ teamId, items }: { teamId: string; items: InvitationSummary[] }) {
  return (
    <section className={styles.list} aria-labelledby="list-title">
      <h2 id="list-title" className={styles.listTitle}>
        Enlaces creados
      </h2>
      {items.length === 0 ? (
        <p className={styles.muted}>Todavía no has creado enlaces.</p>
      ) : (
        <ul className={styles.items}>
          {items.map((item) => (
            <InvitationRow key={item.id} teamId={teamId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationRow({ teamId, item }: { teamId: string; item: InvitationSummary }) {
  const revoke = useRevokeInvitation(teamId);
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const revokeRef = useRef<HTMLButtonElement>(null);
  const active = item.status === 'active';

  // Quien usa teclado no pierde el foco cuando cambia el botón que tocó.
  useEffect(() => {
    if (confirming === true) confirmRef.current?.focus();
    if (confirming === false) revokeRef.current?.focus();
  }, [confirming]);
  const expires = DAY.format(new Date(item.expiresAt));

  return (
    <li className={styles.item}>
      <p className={styles.itemKind}>{invitationLabel(item)}</p>
      <div className={styles.itemHead}>
        <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
        <span className={styles.uses}>
          {item.usedCount} de {item.maxUses} {item.maxUses === 1 ? 'persona' : 'personas'}
        </span>
      </div>
      <p className={styles.muted}>
        {active ? `Vence el ${expires}` : `Creado el ${DAY.format(new Date(item.createdAt))}`}
      </p>

      {active &&
        (confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirmar anulación">
            <p>Quien tenga este enlace ya no podrá unirse con él.</p>
            {revoke.isError && (
              <p role="alert" className={styles.alert}>
                No pudimos anularlo. Intenta de nuevo.
              </p>
            )}
            <Button
              ref={confirmRef}
              variant="secondary"
              busy={revoke.isPending}
              onClick={() => revoke.mutate(item.id)}
            >
              {revoke.isPending ? 'Anulando…' : 'Sí, anular enlace'}
            </Button>
            <Button
              variant="ghost"
              disabled={revoke.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            ref={revokeRef}
            variant="ghost"
            className={styles.revoke}
            onClick={() => setConfirming(true)}
          >
            Anular enlace
          </Button>
        ))}
    </li>
  );
}
