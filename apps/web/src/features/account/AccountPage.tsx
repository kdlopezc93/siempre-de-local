import type { TeamRole } from '@sdl/contracts';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { Ticket } from '@phosphor-icons/react/dist/csr/Ticket';
import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { Token } from '../../shared/ui/Token';
import { useSignOut, useSignOutEverywhere } from '../auth/use-session';
import { rolesLabel } from '../shell/shell-nav';
import { usePush } from '../../shared/push/use-push';
import type { PushState } from '../../shared/push/push';
import switchStyles from '../../shared/ui/Switch.module.css';
import styles from './AccountPage.module.css';
import {
  useDeleteAccount,
  useDeleteChild,
  useDownloadChildData,
  useDownloadMyData,
} from './use-account';
import { firstName } from '../family/family-nav';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Avatar } from '../../shared/ui/Avatar';

const CLUB_ROLE = { owner: 'Dueño', admin: 'Administrador' } as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Lo que permite cada rol, en una línea. Es copia de la matriz del API
 * (`apps/api/src/shared/authz/policy.ts`), que es la que decide: si cambia, cambia esto.
 */
const CAN: Record<TeamRole, string> = {
  coach:
    'valora, puntúa la tarjeta, arma alineaciones, invita jugadores, anula exámenes y pide re-evaluaciones',
  assistant: 'valora, puntúa la tarjeta y arma alineaciones',
  player: 'hace el test y los exámenes; ve su tarjeta si el equipo lo permite',
  treasurer: 'pasa lista en los partidos y maneja los cobros del equipo',
};

/**
 * /cuenta — tú como persona, igual en todos tus equipos: tu perfil, tus equipos con tu rol
 * en cada uno (tus permisos) y cerrar sesión. Se llega desde tu ficha en el encabezado.
 */
export function AccountPage({ me }: { me: Me }) {
  const name = me.profile.displayName;
  return (
    <Screen className={styles.screen}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <PageTitle
            eyebrow="Tu cuenta"
            title={name}
            actions={<Avatar name={name} size={56} shape="circle" />}
          />
          <p className={styles.muted} translate="no">
            {me.user.email}
          </p>
        </div>
      </header>

      <ul className={styles.list}>
        <li>
          <Row
            to="/perfil"
            leading={
              <span className={styles.icon} aria-hidden="true">
                <NotePencil size={22} />
              </span>
            }
            title="Editar mi perfil"
            meta="Cómo te dicen, tu pie, tus posiciones"
          />
        </li>
        {me.user.platformAdmin && (
          <li>
            <Row
              to="/plataforma/codigos"
              leading={
                <span className={styles.icon} aria-hidden="true">
                  <Ticket size={22} />
                </span>
              }
              title="Códigos de alta"
              meta="Para que otros creen su club"
            />
          </li>
        )}
      </ul>

      {(me.teams.length > 0 || me.clubs.length > 0) && (
        <section aria-labelledby="equipos" className={styles.section}>
          <h2 id="equipos" className={styles.sectionTitle}>
            Tus equipos y lo que puedes hacer
          </h2>
          <ul className={styles.teams}>
            {me.teams.map(({ team, club, roles, jerseyNumber }) => (
              <li key={team.id} className={styles.team}>
                <Token text={initialsOf(team.name)} tone="brand" size="sm" />
                <div className={styles.teamText}>
                  <p className={styles.teamName}>
                    {team.name} <span className={styles.muted}>({club.name})</span>
                  </p>
                  <p>
                    {rolesLabel(roles)}
                    {jerseyNumber !== null && `, dorsal ${jerseyNumber}`}
                  </p>
                  <p className={styles.muted}>
                    {roles.map((r, i) => (i === 0 ? cap(CAN[r]) : CAN[r])).join('. También ')}.
                  </p>
                </div>
              </li>
            ))}
            {me.clubs.map((c) => (
              <li key={c.id} className={styles.team}>
                <Avatar name={c.name} size={40} />
                <div className={styles.teamText}>
                  <p className={styles.teamName}>{c.name}</p>
                  <p>{CLUB_ROLE[c.role]} del club</p>
                  <p className={styles.muted}>
                    En sus equipos: ve los resultados, invita jugadores y cuerpo técnico, anula
                    exámenes, pide re-evaluaciones y cambia los ajustes.
                  </p>
                  <Link to={`/clubes/${c.id}`} className={styles.quiet}>
                    Ver el club
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.children.length > 0 && <YourChildren items={me.children} />}
      <Notices />
      <SignOut />
      <YourData hasChildren={me.children.length > 0} />
    </Screen>
  );
}

function SignOut() {
  const signOut = useSignOut();
  const everywhere = useSignOutEverywhere();
  const [open, setOpen] = useState(false);
  const busy = signOut.isPending || everywhere.isPending;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cerrar sesión
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="¿Cerrar sesión?">
        <div className={styles.sheetActions}>
          {(signOut.isError || everywhere.isError) && (
            <p role="alert" className={styles.error}>
              No pudimos cerrar la sesión. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button busy={signOut.isPending} disabled={busy} onClick={() => signOut.mutate()}>
            En este celular
          </Button>
          <Button
            variant="ghost"
            busy={everywhere.isPending}
            disabled={busy}
            onClick={() => everywhere.mutate()}
          >
            En todos tus dispositivos
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** Tus datos (07 §4.5): descargarlos y eliminar tu cuenta, separado de lo demás. */
function YourData({ hasChildren }: { hasChildren: boolean }) {
  const download = useDownloadMyData();
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="tus-datos" className={styles.section}>
      <h2 id="tus-datos" className={styles.sectionTitle}>
        Tus datos
      </h2>
      <Button variant="secondary" busy={download.isPending} onClick={() => download.mutate()}>
        {download.isPending ? 'Preparando…' : 'Descargar mis datos'}
      </Button>
      {download.isError && (
        <p role="alert" className={styles.error}>
          No pudimos preparar el archivo. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <Link to="/tus-datos" className={styles.quiet}>
        Qué guardamos y cómo se elimina
      </Link>
      <button type="button" className={styles.dangerLink} onClick={() => setOpen(true)}>
        Eliminar mi cuenta
      </button>
      <ConfirmDelete
        open={open}
        onClose={() => setOpen(false)}
        title="¿Eliminar tu cuenta?"
        action="Eliminar mi cuenta"
        busy={remove.isPending}
        error={
          remove.isError
            ? remove.error instanceof ApiError && remove.error.status < 500
              ? remove.error.message
              : 'No pudimos eliminar tu cuenta. Revisa tu conexión e intenta de nuevo.'
            : null
        }
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => void navigate('/tus-datos?cuenta=eliminada', { replace: true }),
          })
        }
      >
        <p>
          Se borran tu perfil, tus tests, tus exámenes, tu tarjeta, lo que el cuerpo técnico
          registró sobre ti y tu lugar en tus equipos. No se puede deshacer.
        </p>
        {hasChildren && (
          <p>
            También se borran los datos de tus deportistas, porque eres quien los maneja en la app.
          </p>
        )}
        <p className={styles.muted}>
          Lo que hiciste sobre otros (valoraciones, alineaciones) queda en su equipo, sin tu nombre.
          Si quieres una copia, descárgala antes.
        </p>
      </ConfirmDelete>
    </section>
  );
}

/**
 * Tus deportistas (2026-11-10, registro familia): sus datos son tuyos de manejar. Descargarlos o
 * borrarlos (retirar la autorización), cada uno aparte.
 */
function YourChildren({ items }: { items: Me['children'] }) {
  const download = useDownloadChildData();
  const remove = useDeleteChild();
  const [deleting, setDeleting] = useState<Me['children'][number] | null>(null);
  return (
    <section aria-labelledby="tus-deportistas" className={styles.section}>
      <h2 id="tus-deportistas" className={styles.sectionTitle}>
        Tus deportistas
      </h2>
      <ul className={styles.teams}>
        {items.map((child) => {
          const name = firstName(child.name);
          const busy = download.isPending && download.variables === child.id;
          return (
            <li key={child.id} className={styles.team}>
              <Avatar name={name} size={40} />
              <div className={styles.teamText}>
                <p className={styles.teamName}>{child.name}</p>
                <p className={styles.muted}>
                  {child.teams.map((t) => `${t.team.name}, ${t.club.name}`).join('. ') ||
                    'Sin grupo por ahora'}
                </p>
                <Button variant="secondary" busy={busy} onClick={() => download.mutate(child.id)}>
                  {busy ? 'Preparando…' : `Descargar los datos de ${name}`}
                </Button>
                <button
                  type="button"
                  className={styles.dangerLink}
                  onClick={() => {
                    remove.reset();
                    setDeleting(child);
                  }}
                >
                  Borrar los datos de {name}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {download.isError && (
        <p role="alert" className={styles.error}>
          No pudimos preparar el archivo. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <ConfirmDelete
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `¿Borrar los datos de ${firstName(deleting.name)}?` : ''}
        action="Borrar sus datos"
        busy={remove.isPending}
        error={
          remove.isError
            ? 'No pudimos borrar sus datos. Revisa tu conexión e intenta de nuevo.'
            : null
        }
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      >
        <p>
          Retiras tu autorización: se borran su nombre, su año, su lugar en la escuela, sus
          respuestas a las convocatorias, lo que el profe registró y lo que tiene en las cuentas. No
          se puede deshacer.
        </p>
        <p className={styles.muted}>
          Si quieres una copia, descárgala antes. Para volver a la escuela, lo inscribes de nuevo
          con el enlace de su profe.
        </p>
      </ConfirmDelete>
    </section>
  );
}

/** La hoja de "Escribe ELIMINAR para confirmar": para tu cuenta y para la de cada hijo. */
function ConfirmDelete({
  open,
  onClose,
  title,
  action,
  busy,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  action: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const confirmId = useId();
  const ready = typed.trim().toUpperCase() === 'ELIMINAR';
  return (
    <Sheet
      open={open}
      onClose={() => {
        setTyped('');
        onClose();
      }}
      title={title}
    >
      <form
        className={styles.sheetActions}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onConfirm();
        }}
      >
        {children}
        <label htmlFor={confirmId} className={styles.label}>
          Escribe ELIMINAR para confirmar
        </label>
        <input
          id={confirmId}
          name="confirmation"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={styles.input}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" variant="danger" disabled={!ready} busy={busy}>
          {action}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          No, volver
        </Button>
      </form>
    </Sheet>
  );
}

const NOTICE_HINT: Record<PushState, string> = {
  on: 'Te avisamos cuando te convoquen y cuando salga la alineación.',
  off: 'Igual lo ves en el inicio, en lo que toca.',
  denied: 'Los bloqueaste para esta app. Actívalos en la configuración del navegador.',
  unsupported: 'Este navegador no permite avisos. Lo que toca lo ves en el inicio.',
  'ios-install':
    'En iPhone, primero agrega la app al inicio (Compartir → Agregar a inicio) y ábrela desde ahí.',
  'not-configured': 'Los avisos todavía no están activos en este servidor.',
};

/** Avisos en este celular (Fase 7, D16): opcionales; lo que toca siempre está en el inicio. */
function Notices() {
  const { state, toggle } = usePush();
  if (!state) return null;
  const canToggle = state === 'on' || state === 'off';
  return (
    <section aria-labelledby="avisos" className={styles.section}>
      <h2 id="avisos" className={styles.sectionTitle}>
        Avisos
      </h2>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          role="switch"
          className={switchStyles.switch}
          checked={state === 'on'}
          disabled={!canToggle || toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
        />
        <span>Avisarme en este celular</span>
      </label>
      <p className={styles.muted} aria-live="polite">
        {NOTICE_HINT[state]}
      </p>
      {toggle.isError && (
        <p role="alert" className={styles.error}>
          No pudimos cambiar los avisos. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </section>
  );
}
