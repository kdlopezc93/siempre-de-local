import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { hexToHsv, hexToRgb, hsvToHex, parseHex, rgbToHex, type Hsv } from './color-math';
import styles from './TeamColors.module.css';

/*
 * El selector de un color (2026-11-06, maqueta aprobada por Kevin): los colores de camiseta de un
 * toque, el cuadro de tono y brillo con la barra de color (propios, no el del celular) y el código
 * en HEX o RGB.
 */

export const KIT_COLORS: readonly (readonly [string, string])[] = [
  ['Rojo', '#c8102e'],
  ['Vinotinto', '#6d1a36'],
  ['Naranja', '#ff7a00'],
  ['Amarillo', '#ffd200'],
  ['Dorado', '#c9a227'],
  ['Verde', '#0b7a3b'],
  ['Verde oscuro', '#0a4d2e'],
  ['Celeste', '#8fd3ff'],
  ['Azul rey', '#1d3fbf'],
  ['Azul oscuro', '#0b1f4d'],
  ['Morado', '#5b2a86'],
  ['Rosado', '#e8559a'],
  ['Café', '#6b3e1f'],
  ['Gris', '#8a8f9c'],
  ['Negro', '#141414'],
  ['Blanco', '#ffffff'],
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Arrastrar dentro de un área: (x, y) de 0 a 1. */
function useDrag(onMove: (x: number, y: number) => void) {
  const handle = (event: PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    onMove(
      clamp01((event.clientX - r.left) / r.width),
      clamp01((event.clientY - r.top) / r.height),
    );
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      handle(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) handle(event);
    },
  };
}

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  /** "Principal", "Secundario"…: para los nombres accesibles. */
  label: string;
}) {
  // El tono se guarda aparte: en un gris o en el negro no se puede leer del color.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  // Si el color cambió desde afuera (un ejemplo, un círculo, el código), el cuadro lo sigue.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value));
  }
  const setFromHsv = (next: Hsv) => {
    const hex = hsvToHex(next);
    setHsv(next);
    setSeen(hex);
    onChange(hex);
  };
  const [h, s, v] = hsv;
  const square = useDrag((x, y) => setFromHsv([h, x, 1 - y]));
  const bar = useDrag((x) => setFromHsv([x * 360, s, v]));

  const squareKeys = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Hsv> = {
      ArrowLeft: [h, clamp01(s - step), v],
      ArrowRight: [h, clamp01(s + step), v],
      ArrowUp: [h, s, clamp01(v + step)],
      ArrowDown: [h, s, clamp01(v - step)],
    };
    const next = moves[event.key];
    if (next) {
      event.preventDefault();
      setFromHsv(next);
    }
  };
  const barKeys = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 30 : 5;
    const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[
      event.key
    ];
    if (delta !== undefined) {
      event.preventDefault();
      setFromHsv([(h + delta + 360) % 360, s, v]);
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.kit} role="group" aria-label={`${label}: colores de camiseta`}>
        {KIT_COLORS.map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            className={styles.chip}
            style={{ background: hex }}
            aria-label={name}
            title={name}
            aria-pressed={value === hex}
            onClick={() => onChange(hex)}
          />
        ))}
      </div>

      <div
        {...square}
        className={styles.square}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`,
        }}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: brillo y saturación`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-valuetext={`Saturación ${Math.round(s * 100)} %, brillo ${Math.round(v * 100)} %`}
        onKeyDown={squareKeys}
      >
        <span
          className={styles.knob}
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: value }}
        />
      </div>
      <div
        {...bar}
        className={styles.hue}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: tono`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(h)}
        onKeyDown={barKeys}
      >
        <span
          className={styles.knob}
          style={{ left: `${(h / 360) * 100}%`, top: '50%', background: `hsl(${h} 100% 50%)` }}
        />
      </div>

      <CodeFields value={value} onChange={onChange} />
    </div>
  );
}

/** El código: HEX (con o sin #, 3 o 6) o RGB (0–255). Solo cambia el color cuando es válido. */
function CodeFields({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [mode, setMode] = useState<'hex' | 'rgb'>('hex');
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [rgbDraft, setRgbDraft] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { hex: useId(), r: useId(), g: useId(), b: useId(), error: useId() };
  // Si el color cambió desde afuera, lo que se estaba escribiendo ya no vale.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setHexDraft(null);
    setRgbDraft(null);
    setError(null);
  }
  const emit = (hex: string) => {
    setSeen(hex);
    setError(null);
    onChange(hex);
  };
  const rgb = hexToRgb(value);
  const shownRgb = rgbDraft ?? rgb.map(String);

  function typeHex(text: string) {
    setHexDraft(text);
    const hex = parseHex(text);
    if (hex) emit(hex);
  }
  function typeRgb(i: number, text: string) {
    const next = shownRgb.map((c, j) => (j === i ? text.replace(/\D/g, '') : c));
    setRgbDraft(next);
    const numbers = next.map(Number);
    if (next.every((c) => c !== '') && numbers.every((n) => n >= 0 && n <= 255)) {
      emit(rgbToHex(numbers as [number, number, number]));
    } else if (numbers.some((n) => n > 255)) {
      setError('Cada número va de 0 a 255.');
    }
  }
  const switchTo = (next: 'hex' | 'rgb') => {
    setMode(next);
    setError(null);
    setHexDraft(null);
    setRgbDraft(null);
  };

  return (
    <div className={styles.codes}>
      <div className={styles.tabs} role="group" aria-label="Escribir el código en">
        {(['hex', 'rgb'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={styles.tab}
            aria-pressed={mode === m}
            onClick={() => switchTo(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {mode === 'hex' ? (
        <div className={styles.fields}>
          <label className={styles.field} htmlFor={ids.hex}>
            Código
            <input
              id={ids.hex}
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              value={hexDraft ?? value.toUpperCase()}
              aria-invalid={error !== null}
              aria-describedby={error ? ids.error : undefined}
              onChange={(e) => typeHex(e.target.value)}
              onBlur={() => {
                if (hexDraft !== null && !parseHex(hexDraft)) {
                  setError('Escribe el código así: #C8102E (6 letras o números).');
                } else {
                  setHexDraft(null);
                }
              }}
            />
          </label>
        </div>
      ) : (
        <div className={`${styles.fields} ${styles.rgb}`}>
          {(['r', 'g', 'b'] as const).map((k, i) => (
            <label key={k} className={styles.field} htmlFor={ids[k]}>
              {k.toUpperCase()}
              <input
                id={ids[k]}
                inputMode="numeric"
                autoComplete="off"
                maxLength={3}
                value={shownRgb[i]}
                aria-invalid={error !== null}
                aria-describedby={error ? ids.error : undefined}
                onChange={(e) => typeRgb(i, e.target.value)}
                onBlur={() => {
                  if (!error) setRgbDraft(null);
                }}
              />
            </label>
          ))}
        </div>
      )}
      {error && (
        <p id={ids.error} role="alert" className={styles.codeError}>
          {error}
        </p>
      )}
    </div>
  );
}
