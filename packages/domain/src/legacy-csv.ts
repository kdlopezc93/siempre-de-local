import { POSITIONS, type MatchFormat, type PositionCode } from './positions.js';

/**
 * CSV heredados del prototipo (02 §12): `Nombre, Fecha, Formato, Posicion, Afinidad_%,
 * Podio, Preparacion, Preparacion_%`. Lectura tolerante a mayúsculas, tildes, `_`, `%`,
 * separador `,` o `;` (Excel en español) y encabezados repetidos (varios CSV pegados).
 */
export interface LegacyRow {
  /** Línea del texto donde empieza la fila (1 = primera). */
  line: number;
  playerName: string;
  /** Hora local del celular tal como venía, normalizada a `YYYY-MM-DDTHH:mm`; null si no hay. */
  takenAt: string | null;
  format: MatchFormat | null;
  winner: PositionCode;
  affinityPct: number | null;
  podium: PositionCode[];
  prepScore: number | null;
  prepTotal: number | null;
  /** La fila original, por encabezado. */
  raw: Record<string, string>;
}

export interface LegacyParseResult {
  rows: LegacyRow[];
  rejected: { line: number; reason: string }[];
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_%\s]/g, '');

/** "Defensa central", "defensa central (DC)" o "DFC" → DFC. */
const BY_NAME = new Map<string, PositionCode>(
  (Object.entries(POSITIONS) as [PositionCode, { name: string }][]).flatMap(([code, p]) => [
    [fold(p.name), code],
    [fold(code), code],
  ]),
);

export function positionFromName(value: string): PositionCode | null {
  return BY_NAME.get(fold(value.replace(/\(.*?\)/g, ''))) ?? null;
}

/** RFC 4180: comillas dobles, `""` como comilla escapada y saltos de línea entre comillas. */
function records(text: string, separator: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cells.push(cell);
      out.push({ line: start, cells });
      cells = [];
      cell = '';
      line++;
      start = line;
    } else cell += ch;
  }
  cells.push(cell);
  out.push({ line: start, cells });
  return out.filter((r) => r.cells.some((c) => c.trim() !== ''));
}

function parseDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}`;
}

function parseFormat(value: string): MatchFormat | null {
  const f = fold(value);
  if (f.includes('11')) return 'F11';
  if (f.includes('8')) return 'F8';
  return null;
}

export function parseLegacyCsv(input: string): LegacyParseResult {
  // Sin la marca de orden de bytes (U+FEFF) que pone Excel o el prototipo.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const all = records(text, separator);
  const rows: LegacyRow[] = [];
  const rejected: LegacyParseResult['rejected'] = [];
  const [head, ...body] = all;
  if (!head) return { rows, rejected };

  const headers = head.cells.map((c) => c.trim());
  const keys = headers.map((h) => fold(h));
  const column = (name: string) => keys.indexOf(name);
  if (column('nombre') < 0 || column('posicion') < 0) {
    return { rows, rejected: [{ line: 1, reason: 'Faltan las columnas Nombre y Posicion' }] };
  }
  const headerSignature = keys.join('|');

  for (const { line, cells } of body) {
    // Otro CSV pegado a continuación: su encabezado se salta.
    if (cells.map((c) => fold(c.trim())).join('|') === headerSignature) continue;
    const get = (name: string) => (cells[column(name)] ?? '').trim();
    const raw = Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]));

    const playerName = get('nombre');
    if (!playerName) {
      rejected.push({ line, reason: 'Falta el nombre' });
      continue;
    }
    const winner = positionFromName(get('posicion'));
    if (!winner) {
      rejected.push({ line, reason: `Posición desconocida: "${get('posicion')}"` });
      continue;
    }
    const podium = get('podio')
      .split('|')
      .map((part) => positionFromName(part))
      .filter((pos): pos is PositionCode => pos !== null)
      .slice(0, 3);
    const affinity = Number.parseFloat(get('afinidad'));
    // "Preparacion" (7/8) va antes que "Preparacion_%": las dos se pliegan igual y gana la primera.
    const prep = get('preparacion').match(/(\d+)\s*\/\s*(\d+)/);
    rows.push({
      line,
      playerName,
      takenAt: parseDate(get('fecha')),
      format: parseFormat(get('formato')),
      winner,
      affinityPct: Number.isFinite(affinity) ? Math.round(affinity) : null,
      podium: podium.length ? podium : [winner],
      prepScore: prep ? Number(prep[1]) : null,
      prepTotal: prep ? Number(prep[2]) : null,
      raw,
    });
  }
  return { rows, rejected };
}
