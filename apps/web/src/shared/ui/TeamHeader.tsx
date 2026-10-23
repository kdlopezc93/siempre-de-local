import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { useState } from 'react';
import { Link } from 'react-router';

import { Sheet } from './Sheet';
import styles from './TeamHeader.module.css';
import { Token } from './Token';

export interface HeaderTeam {
  id: string;
  name: string;
  club: string;
  /** Lo que se lee debajo del nombre en el selector: "Entrenador y jugador". */
  roles: string;
  format: string;
}

const LINKING_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);

/** Iniciales para un escudo o una ficha: "Primer equipo" → "PE", "Los del jueves" → "LJ". */
export function initialsOf(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  if (!first) return '';
  const last = rest.filter((w) => !LINKING_WORDS.has(w.toLowerCase())).at(-1);
  return (first[0]! + (last?.[0] ?? first[1] ?? '')).toUpperCase();
}

/**
 * Arriba en cada pantalla del equipo: su escudo, su nombre, el club y el formato. Si estás en
 * más de un equipo, al tocarlo se abre la lista para cambiar.
 */
export function TeamHeader({
  team,
  teams,
  onSwitch,
  account,
}: {
  team: HeaderTeam;
  teams: readonly HeaderTeam[];
  onSwitch: (teamId: string) => void;
  /** Tu ficha a la derecha: lleva a tu cuenta (perfil, roles, cerrar sesión). */
  account?: { name: string; to: string };
}) {
  const [open, setOpen] = useState(false);
  const switchable = teams.length > 1;
  const content = (
    <>
      <Token text={initialsOf(team.name)} tone="amber" size="sm" />
      <span className={styles.text}>
        <span className={styles.name}>{team.name}</span>
        <span className={styles.meta}>
          {team.club}, {team.format}
        </span>
      </span>
      {switchable && <CaretDown size={18} className={styles.caret} aria-hidden="true" />}
    </>
  );

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {switchable ? (
          <button
            type="button"
            className={styles.team}
            aria-haspopup="dialog"
            aria-label={`${team.name}. Cambiar de equipo`}
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
        <Sheet open={open} onClose={() => setOpen(false)} title="Tus equipos">
          <ul className={styles.list}>
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={styles.option}
                  aria-current={t.id === team.id || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (t.id !== team.id) onSwitch(t.id);
                  }}
                >
                  <Token text={initialsOf(t.name)} tone={t.id === team.id ? 'amber' : 'board'} />
                  <span className={styles.text}>
                    <span className={styles.name}>{t.name}</span>
                    <span className={styles.meta}>
                      {t.club}. {t.roles}
                    </span>
                  </span>
                  {t.id === team.id && <Check size={22} weight="bold" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </header>
  );
}
