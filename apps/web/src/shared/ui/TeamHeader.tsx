import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { useState } from 'react';
import { Link } from 'react-router';

import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import styles from './TeamHeader.module.css';
import { Token } from './Token';
import { initialsOf } from '@sdl/domain';

export interface HeaderTeam {
  id: string;
  name: string;
  club: string;
  /** Lo que se lee debajo del nombre en el selector: "Entrenador y jugador". */
  roles: string;
  format: string;
}

/**
 * Un hijo del acudiente en uno de sus grupos (escuelas, 2026-11-10): en la app del acudiente va
 * arriba en lugar del equipo, y en el selector junto a tus equipos.
 */
export interface HeaderKid {
  id: string;
  teamId: string;
  /** Nombre de pila. */
  name: string;
  /** "Sub-10 femenino, Semillas del Sur". */
  group: string;
  /** Tiene algo por responder (2026-11-10): un punto en el selector. */
  pending?: boolean;
}

/** Las iniciales del escudo viven en el dominio: las usa también la vista previa de los links. */
export { initialsOf };

const sameKid = (a: HeaderKid | undefined, b: HeaderKid) =>
  !!a && a.id === b.id && a.teamId === b.teamId;

/**
 * Arriba en cada pantalla del equipo: su escudo, su nombre, el club y el formato. En la app del
 * acudiente, el deportista que estás viendo (`kid`). Si hay más de un equipo, o hijos, al tocarlo
 * se abre la lista para cambiar.
 */
export function TeamHeader({
  team,
  kid,
  teams,
  kids = [],
  onSwitch,
  onPickKid,
  account,
}: {
  /** El equipo activo; si se pasa `kid`, ese manda. */
  team?: HeaderTeam;
  kid?: HeaderKid;
  teams: readonly HeaderTeam[];
  kids?: readonly HeaderKid[];
  onSwitch: (teamId: string) => void;
  onPickKid?: (kid: HeaderKid) => void;
  /** Tu ficha a la derecha: lleva a tu cuenta (perfil, roles, cerrar sesión). */
  account?: { name: string; to: string };
}) {
  const [open, setOpen] = useState(false);
  const switchable = teams.length + kids.length > 1;
  const current = kid ? null : (team ?? null);
  const title = kid ? kid.name : (current?.name ?? '');
  // Otro hijo tiene algo pendiente: el punto también va arriba, para verlo sin abrir.
  const elsewhere = kids.some((k) => k.pending && !sameKid(kid, k));
  const content = (
    <>
      {kid ? (
        <span className={styles.badged}>
          <Avatar name={kid.name} size={40} />
          {elsewhere && <span className={styles.dot} aria-hidden="true" />}
        </span>
      ) : (
        <Token text={initialsOf(title)} tone="brand" size="sm" />
      )}
      <span className={styles.text}>
        <span className={styles.name}>{title}</span>
        <span className={styles.meta}>
          {kid ? kid.group : `${current?.club}, ${current?.format}`}
        </span>
      </span>
      {switchable && <CaretDown size={18} className={styles.caret} aria-hidden="true" />}
    </>
  );
  const both = kids.length > 0 && teams.length > 0;
  const sheetTitle = kids.length === 0 ? 'Tus equipos' : both ? 'Cambiar' : 'Tus deportistas';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {switchable ? (
          <button
            type="button"
            className={styles.team}
            aria-haspopup="dialog"
            aria-label={`${title}. ${kid ? 'Cambiar de deportista' : 'Cambiar de equipo'}${elsewhere ? '. Hay algo pendiente' : ''}`}
            onClick={() => setOpen(true)}
          >
            {content}
          </button>
        ) : (
          <div className={styles.team}>{content}</div>
        )}
        {account && (
          <Link
            to={account.to}
            className={styles.account}
            aria-label={`Tu cuenta, ${account.name}`}
          >
            <Token text={initialsOf(account.name)} size="sm" />
          </Link>
        )}
      </div>
      {switchable && (
        <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle}>
          {kids.length > 0 && (
            <section aria-label="Tus deportistas">
              {both && <h3 className={styles.group}>Tus deportistas</h3>}
              <ul className={styles.list}>
                {kids.map((k) => {
                  const here = sameKid(kid, k);
                  return (
                    <li key={`${k.id}:${k.teamId}`}>
                      <button
                        type="button"
                        className={styles.option}
                        aria-current={here || undefined}
                        onClick={() => {
                          setOpen(false);
                          if (!here) onPickKid?.(k);
                        }}
                      >
                        <span className={styles.badged}>
                          <Avatar name={k.name} size={44} />
                          {k.pending && (
                            <span className={styles.dot}>
                              <span className="sr-only">Tiene algo por responder</span>
                            </span>
                          )}
                        </span>
                        <span className={styles.text}>
                          <span className={styles.name}>{k.name}</span>
                          <span className={styles.meta}>{k.group}</span>
                        </span>
                        {here && <Check size={22} weight="bold" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {teams.length > 0 && (
            <section aria-label="Tus equipos">
              {both && <h3 className={styles.group}>Tus equipos</h3>}
              <ul className={styles.list}>
                {teams.map((t) => {
                  const here = t.id === current?.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={styles.option}
                        aria-current={here || undefined}
                        onClick={() => {
                          setOpen(false);
                          if (!here) onSwitch(t.id);
                        }}
                      >
                        <Token text={initialsOf(t.name)} tone={here ? 'brand' : 'board'} />
                        <span className={styles.text}>
                          <span className={styles.name}>{t.name}</span>
                          <span className={styles.meta}>
                            {t.club}. {t.roles}
                          </span>
                        </span>
                        {here && <Check size={22} weight="bold" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </Sheet>
      )}
    </header>
  );
}
