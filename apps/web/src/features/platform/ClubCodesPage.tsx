import type { ClubCodeSummary, CreateClubCodeResponse } from '@sdl/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { useCopy, whatsappUrl } from '../team-admin/use-invitations';
import styles from './ClubCodesPage.module.css';
import {
  clubCodeMessage,
  useClubCodes,
  useCreateClubCode,
  useRevokeClubCode,
} from './use-club-codes';

const STATUS: Record<ClubCodeSummary['status'], { label: string; tone: BadgeTone }> = {
  active: { label: 'Activo', tone: 'success' },
  used: { label: 'Usado', tone: 'brand' },
  expired: { label: 'Vencido', tone: 'danger' },
  revoked: { label: 'Anulado', tone: 'neutral' },
};

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });

/**
 * /plataforma/codigos — los códigos de alta de clubes (Kevin, 2026-10-29): crear un club desde
 * la app pide uno. Solo el administrador de la plataforma.
 */
export function ClubCodesPage({ me }: { me: Me }) {
  const back = (
    <Link to="/cuenta" className={styles.back}>
      Tu cuenta
    </Link>
  );
  if (!me.user.platformAdmin) {
    return (
      <Screen className={styles.screen}>
        {back}
        <PageTitle eyebrow="Plataforma" title="Códigos de alta" />
        <p role="alert" className={styles.lead}>
          Solo el administrador de la plataforma genera códigos de alta.
        </p>
      </Screen>
    );
  }
  return (
    <Screen className={styles.screen}>
      {back}
      <header>
        <PageTitle eyebrow="Plataforma" title="Códigos de alta" />
        <p className={styles.lead}>
          Con un código, alguien crea su club y su primer equipo desde la app. Cada código sirve
          para un club y vence en 14 días.
        </p>
      </header>
      <CreateCode />
      <CodeList />
    </Screen>
  );
}

function CreateCode() {
  const create = useCreateClubCode();
  const [note, setNote] = useState('');
  const noteId = useId();
  if (create.isSuccess) {
    return (
      <FreshCode
        created={create.data}
        onAnother={() => {
          setNote('');
          create.reset();
        }}
      />
    );
  }
  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ note: note.trim() || undefined });
      }}
    >
      <label htmlFor={noteId} className={styles.label}>
        ¿Para quién es? (opcional)
      </label>
      <input
        id={noteId}
        className={styles.input}
        value={note}
        maxLength={80}
        autoComplete="off"
        placeholder="Ej.: Pedro, Los Tigres"
        onChange={(event) => setNote(event.target.value)}
      />
      <p className={styles.hint}>Solo lo ves tú, para reconocerlo en la lista.</p>
      {create.isError && (
        <p role="alert" className={styles.alert}>
          No pudimos crear el código. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <Button type="submit" busy={create.isPending}>
        {create.isPending ? 'Creando…' : 'Crear código'}
      </Button>
    </form>
  );
}

/** El código recién creado: es la única vez que se ve (en la BD queda su hash). */
function FreshCode({
  created,
  onAnother,
}: {
  created: CreateClubCodeResponse;
  onAnother: () => void;
}) {
  const { copied, copy } = useCopy();
  const [copyFailed, setCopyFailed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const message = clubCodeMessage(created.code, created.url);
  useEffect(() => titleRef.current?.focus(), []);
  return (
    <section className={styles.card} aria-labelledby="fresh-title">
      <h2 id="fresh-title" ref={titleRef} tabIndex={-1} className={styles.cardTitle}>
        Tu código está listo
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
        {created.url}
      </p>
      <a
        className={styles.whatsapp}
        href={whatsappUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Compartir por WhatsApp
      </a>
      <Button variant="secondary" onClick={async () => setCopyFailed(!(await copy(message)))}>
        {copied ? 'Copiado' : 'Copiar mensaje'}
      </Button>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Mensaje copiado' : ''}
      </p>
      {copyFailed && (
        <p role="alert" className={styles.alert}>
          Tu navegador no dejó copiar. Mantén presionado el enlace de arriba para copiarlo.
        </p>
      )}
      <p className={styles.hint}>
        Guárdalo ahora: por seguridad no lo volvemos a mostrar. Si lo pierdes, crea otro.
      </p>
      <Button variant="ghost" onClick={onAnother}>
        Crear otro código
      </Button>
    </section>
  );
}

function CodeList() {
  const codes = useClubCodes();
  if (!codes.data) {
    return codes.isError ? (
      <p role="alert" className={styles.alert}>
        No pudimos cargar los códigos. Revisa tu conexión.
      </p>
    ) : null;
  }
  return (
    <section aria-labelledby="codes-title" className={styles.section}>
      <h2 id="codes-title" className={styles.sectionTitle}>
        Códigos creados
      </h2>
      {codes.data.items.length === 0 ? (
        <p className={styles.hint}>Todavía no has creado códigos.</p>
      ) : (
        <ul className={styles.list}>
          {codes.data.items.map((item) => (
            <CodeRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CodeRow({ item }: { item: ClubCodeSummary }) {
  const revoke = useRevokeClubCode();
  const [confirming, setConfirming] = useState(false);
  const status = STATUS[item.status];
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <span className={styles.itemNote}>{item.note ?? 'Sin nota'}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className={styles.hint}>
        {item.club
          ? `Creó el club ${item.club.name}`
          : item.status === 'active'
            ? `Vence el ${DAY.format(new Date(item.expiresAt))}`
            : `Creado el ${DAY.format(new Date(item.createdAt))}`}
      </p>
      {item.status === 'active' &&
        (confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirmar anulación">
            <p>Quien tenga este código ya no podrá crear su club con él.</p>
            {revoke.isError && (
              <p role="alert" className={styles.alert}>
                No pudimos anularlo. Intenta de nuevo.
              </p>
            )}
            <Button
              variant="secondary"
              busy={revoke.isPending}
              onClick={() => revoke.mutate(item.id)}
            >
              Sí, anular código
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
          <button type="button" className={styles.revoke} onClick={() => setConfirming(true)}>
            Anular código
          </button>
        ))}
    </li>
  );
}
