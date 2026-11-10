import type { MatchReply } from '@sdl/contracts';

import styles from './Family.module.css';

/**
 * Va / No va por el niño. La elegida queda rellena (`aria-pressed`). `onBrand`: dentro del
 * bloque cobalto, la elegida en volt.
 */
export function ReplyButtons({
  name,
  value,
  busy,
  onReply,
  onBrand = false,
}: {
  name: string;
  value: MatchReply | null;
  busy: boolean;
  onReply: (reply: MatchReply) => void;
  onBrand?: boolean;
}) {
  return (
    <div
      className={styles.replies}
      data-on-brand={onBrand || undefined}
      role="group"
      aria-label={`¿${name} va?`}
      aria-busy={busy || undefined}
    >
      {(['yes', 'no'] as const).map((reply) => (
        <button
          key={reply}
          type="button"
          className={styles.reply}
          aria-pressed={value === reply}
          disabled={busy}
          onClick={() => value !== reply && onReply(reply)}
        >
          {reply === 'yes' ? 'Va' : 'No va'}
        </button>
      ))}
    </div>
  );
}
