const LINKING_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);

/** Iniciales para un escudo o una ficha: "Primer equipo" → "PE", "Los del jueves" → "LJ". */
export function initialsOf(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  if (!first) return '';
  const last = rest.filter((w) => !LINKING_WORDS.has(w.toLowerCase())).at(-1);
  return (first[0]! + (last?.[0] ?? first[1] ?? '')).toUpperCase();
}
