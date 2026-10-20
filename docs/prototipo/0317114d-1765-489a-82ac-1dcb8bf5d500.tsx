import React, { useState, useMemo, useEffect } from "react";
import Papa from "papaparse";

/* ============================================================
   PLANIFICADOR DE PARTIDO — a partir del CSV consolidado que
   exporta el panel de resultados, marca quién confirmó para un
   partido y arma la alineación solo con esos jugadores.
   Si una posición no tiene a nadie disponible de ese rol, busca
   el mejor reemplazo en 3 niveles: exacto -> por podio del test
   -> estimación por perfil físico + posiciones afines. Nunca deja
   un hueco vacío salvo que ya no queden jugadores disponibles.
   ============================================================ */

const POSITIONS = {
  POR: { name: "Portero", num: 1 },
  LAT: { name: "Lateral", num: 2 },
  DFC: { name: "Defensa central", num: 4 },
  MC: { name: "Mediocentro", num: 8 },
  EXT: { name: "Extremo", num: 7 },
  DC: { name: "Delantero centro", num: 9 },
};
const ORDER = ["POR", "LAT", "DFC", "MC", "EXT", "DC"];
const NAME_TO_KEY = Object.fromEntries(
  Object.entries(POSITIONS).map(([k, v]) => [v.name.toLowerCase(), k])
);
const NOTATION_LABEL = {
  PT: "Portero", DC: "Defensa central", LWB: "Carrilero izquierdo", RWB: "Carrilero derecho",
  CM: "Mediocentro", LW: "Extremo izquierdo", RW: "Extremo derecho", ST: "Delantero centro",
  CDM: "Mediocentro defensivo", SS: "Segundo delantero",
};
const LEGACY_FOLD = { pivote: "MC", mediapunta: "DC" };

/* --------- Las 4 alineaciones (viewBox 100x150), iguales al panel --------- */
const FORMATIONS = {
  "1-3-3-1": { label: "1-3-3-1", slots: [
    { code: "PT", role: "POR", coord: [50, 139] },
    { code: "LWB", role: "LAT", side: "izquierda", coord: [16, 112] },
    { code: "DC", role: "DFC", coord: [50, 116] },
    { code: "RWB", role: "LAT", side: "derecha", coord: [84, 112] },
    { code: "LW", role: "EXT", side: "izquierda", coord: [20, 72] },
    { code: "CM", role: "MC", coord: [50, 78] },
    { code: "RW", role: "EXT", side: "derecha", coord: [80, 72] },
    { code: "ST", role: "DC", coord: [50, 32] },
  ] },
  "1-2-4-1": { label: "1-2-4-1", slots: [
    { code: "PT", role: "POR", coord: [50, 139] },
    { code: "DC", role: "DFC", coord: [35, 118] },
    { code: "DC", role: "DFC", coord: [65, 118] },
    { code: "LW", role: "EXT", side: "izquierda", coord: [14, 84] },
    { code: "CDM", role: "MC", coord: [38, 90] },
    { code: "CM", role: "MC", coord: [62, 90] },
    { code: "RW", role: "EXT", side: "derecha", coord: [86, 84] },
    { code: "ST", role: "DC", coord: [50, 32] },
  ] },
  "1-3-4": { label: "1-3-4 (sin delantero)", slots: [
    { code: "PT", role: "POR", coord: [50, 139] },
    { code: "LWB", role: "LAT", side: "izquierda", coord: [16, 116] },
    { code: "DC", role: "DFC", coord: [50, 120] },
    { code: "RWB", role: "LAT", side: "derecha", coord: [84, 116] },
    { code: "LW", role: "EXT", side: "izquierda", coord: [14, 66] },
    { code: "CDM", role: "MC", coord: [38, 72] },
    { code: "CM", role: "MC", coord: [62, 72] },
    { code: "RW", role: "EXT", side: "derecha", coord: [86, 66] },
  ] },
  "1-2-3-2": { label: "1-2-3-2", slots: [
    { code: "PT", role: "POR", coord: [50, 139] },
    { code: "DC", role: "DFC", coord: [35, 118] },
    { code: "DC", role: "DFC", coord: [65, 118] },
    { code: "CDM", role: "MC", coord: [50, 96] },
    { code: "CM", role: "MC", coord: [30, 80] },
    { code: "CM", role: "MC", coord: [70, 80] },
    { code: "ST", role: "DC", coord: [38, 34] },
    { code: "SS", role: "DC", coord: [62, 34] },
  ] },
};
const FORMATION_ORDER = ["1-3-3-1", "1-2-4-1", "1-3-4", "1-2-3-2"];

/* --------- utilidades de parseo (iguales al panel) --------- */
function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/[_\s]/g, "");
}
function getField(row, ...names) {
  const targets = names.map(norm);
  for (const key of Object.keys(row)) {
    if (targets.includes(norm(key))) return row[key];
  }
  return "";
}
function parsePrepFraction(v) {
  const m = String(v || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { n: +m[1], d: +m[2] };
  return null;
}
function parsePodium(str) {
  if (!str) return [];
  return String(str)
    .split("|")
    .map((s) => s.trim())
    .map((part) => {
      const m = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)$/);
      return m ? { name: m[1].trim(), pct: parseFloat(m[2]) } : null;
    })
    .filter(Boolean);
}
function prepTier(pct) {
  if (pct == null) return null;
  if (pct >= 85) return "great";
  if (pct >= 60) return "good";
  if (pct >= 37.5) return "ok";
  return "low";
}
function prepTierClass(pct) {
  const t = prepTier(pct);
  return t ? `mp-tier-${t}` : "";
}

/* --------- inferencia de versatilidad y recomendación por jugador ---------
   Igual que en panel-resultados.jsx (sección 12 del traspaso): compara el
   1º y 2º puesto del podio, y cruza afinidad/preparación en reglas
   explícitas y explicables. Se porta acá para poder ver el mismo detalle
   de un jugador sin salir del planificador. */
function inferVersatility(podiumArr) {
  if (podiumArr.length < 2) return null;
  const gap = podiumArr[0].pct - podiumArr[1].pct;
  if (gap <= 15) return { tag: "versatile", label: `Versátil — también rinde en ${podiumArr[1].name}` };
  if (gap >= 40) return { tag: "specialist", label: "Especialista claro" };
  return null;
}
function affTier(aff) {
  if (aff == null) return null;
  if (aff >= 60) return "high";
  if (aff >= 45) return "mid";
  return "low";
}
function recommendationFor(r, podiumArr) {
  const affT = affTier(r.affinity);
  const prepT = prepTier(r.prepPct);
  if (affT == null || prepT == null) return null;
  const strong = prepT === "great" || prepT === "good";
  const vers = inferVersatility(podiumArr);
  if (vers && vers.tag === "versatile") return { text: vers.label, tag: "good" };
  if (affT === "high") {
    return strong
      ? { text: "Listo para titular", tag: "great" }
      : { text: "Foco: preparación táctica", tag: "ok" };
  }
  if (vers && vers.tag === "specialist") {
    return strong
      ? { text: "Especialista claro — perfil consolidado en esta posición", tag: "great" }
      : { text: "Especialista claro, pero le falta preparación táctica", tag: "ok" };
  }
  if (affT === "mid") {
    return strong
      ? { text: "Prep. sólida, pero su mejor encaje podría estar en otra posición", tag: "ok" }
      : { text: "Perfil razonable; conviene reforzar los fundamentos de la posición", tag: "ok" };
  }
  return strong
    ? { text: "Prep. sólida, pero el test no ve este perfil ideal aquí", tag: "ok" }
    : { text: "Perfil y preparación aún lejos de esta posición; vale la pena observarlo en otras", tag: "low" };
}

function rowToRecord(row) {
  const posName = String(getField(row, "Posicion", "Posición")).trim().toLowerCase();
  const key = NAME_TO_KEY[posName] || LEGACY_FOLD[posName];
  if (!key) return null;
  const legacy = !NAME_TO_KEY[posName];
  const prepFrac = parsePrepFraction(getField(row, "Preparacion", "Preparación"));
  const prepPct = parseFloat(getField(row, "Preparacion_%", "Preparación_%")) ||
    (prepFrac ? Math.round((prepFrac.n / prepFrac.d) * 100) : null);
  const side = String(getField(row, "Perfil_banda", "Perfil banda", "Banda") || "").trim().toLowerCase() || null;
  return {
    name: (getField(row, "Nombre") || "Anónimo").trim(),
    date: (getField(row, "Fecha") || "").trim(),
    format: (getField(row, "Formato") || "").trim(),
    posKey: key,
    posName: POSITIONS[key].name,
    notation: (getField(row, "Posicion_Detalle", "Posición_Detalle") || "").trim(),
    height: getField(row, "Altura") || "",
    weight: getField(row, "Peso") || "",
    foot: (getField(row, "Pie_dominante", "Pie dominante") || "").trim().toLowerCase(),
    side,
    legacy,
    affinity: parseFloat(getField(row, "Afinidad_%", "Afinidad")) || null,
    podium: (getField(row, "Podio") || "").trim(),
    podiumArr: parsePodium(getField(row, "Podio") || ""),
    prepN: prepFrac ? prepFrac.n : null,
    prepD: prepFrac ? prepFrac.d : 8,
    prepPct,
  };
}
function sig(r) { return `${r.name}|${r.date}|${r.posKey}`; }

/* --------- estimación física por posición (portada del test) ---------
   Mismas fórmulas y techo (PHYSICAL_MAX) que usa detector-posicion.jsx
   para puntuar el perfil físico, reutilizadas aquí para poder estimar
   qué tan bien encajaría un jugador en una posición que NUNCA le salió
   como resultado (nivel 3 del relleno de huecos). */
function heightBand(h) { if (!h || h <= 0) return null; if (h >= 180) return "alto"; if (h >= 170) return "medio"; return "bajo"; }
function weightBand(w) { if (!w || w <= 0) return null; if (w >= 75) return "pesado"; if (w >= 60) return "medio"; return "ligero"; }
function physicalPointsFor(profile) {
  const pts = { POR: 0, LAT: 0, DFC: 0, MC: 0, EXT: 0, DC: 0 };
  const h = heightBand(Number(profile.height));
  const w = weightBand(Number(profile.weight));
  if (h === "alto") { pts.POR += 3; pts.DFC += 3; pts.DC += 1; }
  else if (h === "bajo") { pts.EXT += 2; pts.MC += 1; }
  else if (h === "medio") { pts.DFC += 1; }
  if (w === "pesado") { pts.DFC += 2; pts.DC += 1; }
  else if (w === "ligero") { pts.EXT += 1; pts.LAT += 1; }
  if (profile.side === "centro") { pts.DFC += 1; pts.MC += 1; pts.DC += 1; }
  else if (profile.side === "izquierda" || profile.side === "derecha") {
    const natural = profile.foot === "ambidiestro" ||
      (profile.foot === "derecho" && profile.side === "derecha") ||
      (profile.foot === "izquierdo" && profile.side === "izquierda");
    if (natural) pts.LAT += 2;
    else pts.EXT += 2;
  }
  return pts;
}
const PHYSICAL_MAX = (() => {
  const heights = [160, 174, 185];
  const weights = [55, 67, 80];
  const feet = ["izquierdo", "derecho", "ambidiestro"];
  const sides = ["izquierda", "centro", "derecha"];
  const max = { POR: 0, LAT: 0, DFC: 0, MC: 0, EXT: 0, DC: 0 };
  heights.forEach((h) => weights.forEach((w) => feet.forEach((f) => sides.forEach((s) => {
    const pts = physicalPointsFor({ height: h, weight: w, foot: f, side: s });
    ORDER.forEach((p) => { if (pts[p] > max[p]) max[p] = pts[p]; });
  }))));
  return max;
})();

/* --------- posiciones afines, de más a menos parecida ---------
   Se usa solo cuando nadie disponible tiene la posición faltante
   ni siquiera en su podio (nivel 3): da un orden de prioridad base
   por lógica futbolística (lateral/extremo comparten banda, mediocentro/
   defensa central comparten perfil defensivo, extremo/delantero
   comparten último tercio), que luego se afina con el encaje físico
   estimado y la preparación general. */
const ADJACENCY = {
  POR: ["DFC", "LAT", "MC", "EXT", "DC"],
  LAT: ["EXT", "DFC", "MC", "DC", "POR"],
  DFC: ["MC", "LAT", "POR", "EXT", "DC"],
  MC: ["DFC", "EXT", "LAT", "DC", "POR"],
  EXT: ["LAT", "DC", "MC", "DFC", "POR"],
  DC: ["EXT", "MC", "LAT", "DFC", "POR"],
};

/* --------- puntaje unificado (jugador, puesto) ---------
   Mismos 3 niveles de antes (exacto/podio/estimación) pero como UN
   número en vez de 3 pasadas separadas, para poder resolver la
   asignación completa de una sola vez (ver 13.6 del traspaso):
   exacto: 1000 + afinidad (+ bono si el lado coincide)
   podio:   500 + % de esa posición en el podio del test
   estimación: adyacencia (0-50) + encaje físico (0-50) + prep (0-10)
   Las bandas quedan separadas a propósito: dentro de un mismo nivel,
   compiten por afinidad/%/encaje; entre niveles, exacto siempre pesa
   más que podio y podio más que estimación. */
// El "rating" (0-100, solo para mostrar en pantalla) se banda por nivel a
// propósito, igual que el puntaje interno: cualquier resultado de podio
// muestra más que cualquier estimación, y cualquier exacto muestra más que
// cualquier podio — nunca se cruzan. Sin esto, un podio real pero modesto
// (ej. 22%) podía mostrar menos que una estimación sin ningún dato (ej. 50%
// solo por cercanía de posición), dando la impresión de que "estimar" es
// mejor que un dato validado por el test, que es al revés de lo que dice
// el puntaje interno que realmente decide la asignación (ver 13.8 del
// traspaso: se detectó con un caso real donde un armado a mano parecía
// mejor en el resumen por línea pero puntuaba muchísimo peor por dentro).
function scoreFor(rec, slot) {
  const role = slot.role;
  if (rec.posKey === role) {
    const sideBonus = slot.side && rec.side === slot.side ? 50 : 0;
    const affinity = rec.affinity ?? 100;
    return { score: 1000 + affinity + sideBonus, tier: "exact", rating: Math.round(65 + (Math.min(100, affinity) / 100) * 35) };
  }
  const posName = POSITIONS[role].name;
  const entry = (rec.podiumArr || []).find((p) => p.name === posName);
  if (entry) {
    return { score: 500 + entry.pct, tier: "podium", rating: Math.round(35 + (Math.min(100, entry.pct) / 100) * 30), detail: `${entry.pct}% en el podio` };
  }
  const rank = ADJACENCY[role] ? ADJACENCY[role].indexOf(rec.posKey) : -1;
  const adjacencyScore = rank === -1 ? 0 : (5 - rank) * 10;
  let physicalFitPct = null;
  if (rec.height || rec.weight || rec.foot || rec.side) {
    const pts = physicalPointsFor({ height: rec.height, weight: rec.weight, foot: rec.foot, side: rec.side });
    physicalFitPct = PHYSICAL_MAX[role] ? Math.round((pts[role] / PHYSICAL_MAX[role]) * 100) : 0;
  }
  const prepPct = rec.prepPct || 0;
  const score = adjacencyScore + (physicalFitPct != null ? physicalFitPct * 0.5 : 0) + prepPct * 0.1;
  const base = physicalFitPct != null ? (adjacencyScore + physicalFitPct) / 2 : adjacencyScore;
  const rating = Math.min(34, Math.round(base));
  const detail = physicalFitPct != null ? `~${physicalFitPct}% de encaje físico estimado` : "sin perfil físico, estimado solo por posición afín";
  return { score, tier: "estimate", rating, detail };
}

const LINE_OF = { POR: "defensa", LAT: "defensa", DFC: "defensa", MC: "medio", EXT: "ataque", DC: "ataque" };
const LINE_LABEL = { defensa: "Defensa", medio: "Medio", ataque: "Ataque" };

/* --------- algoritmo húngaro (Kuhn-Munkres), O(n^3), minimización ---------
   Resuelve el "assignment problem": dada una matriz de costos filas×columnas
   (n <= m), encuentra la asignación de cada fila a una columna distinta que
   minimiza el costo total — óptimo garantizado, no depende del orden en que
   se procesan los huecos (a diferencia del llenado por niveles anterior).
   Implementación estándar, verificada contra fuerza bruta en 200 casos
   aleatorios antes de usarla acá. Fuente: Kuhn, "The Hungarian Method for
   the Assignment Problem"; ver sección 13.6 del traspaso para más
   referencias. */
function hungarianMin(a) {
  const n = a.length, m = a[0].length;
  const INF = Infinity;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = -1;
      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const rowOf = new Array(m).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j] > 0) rowOf[j - 1] = p[j] - 1;
  return rowOf;
}

// Resuelve un subconjunto de huecos con un subconjunto de jugadores (usado
// por assignMatchDayOptimal en 1 o 2 pasadas según el modo).
function solveSlots(pool, slotEntries) {
  const n = pool.length, m = slotEntries.length;
  const assigned = new Array(m).fill(null);
  if (n === 0 || m === 0) return { assigned, usedOrigIdx: [] };
  const scoreMat = pool.map((p) => slotEntries.map((s) => scoreFor(p.rec, s.slot)));
  const BIG = 100000;
  const usedOrigIdx = [];
  if (n <= m) {
    const cost = scoreMat.map((row) => row.map((c) => BIG - c.score));
    const rowOf = hungarianMin(cost);
    rowOf.forEach((ri, j) => {
      if (ri !== -1) { assigned[j] = { rec: pool[ri].rec, ...scoreMat[ri][j] }; usedOrigIdx.push(pool[ri].origIdx); }
    });
  } else {
    const costT = slotEntries.map((s, j) => pool.map((p) => BIG - scoreMat[pool.indexOf(p)][j].score));
    const rowOf = hungarianMin(costT);
    rowOf.forEach((slotIdx, ci) => {
      if (slotIdx !== -1) { assigned[slotIdx] = { rec: pool[ci].rec, ...scoreMat[ci][slotIdx] }; usedOrigIdx.push(pool[ci].origIdx); }
    });
  }
  return { assigned, usedOrigIdx };
}

/* --------- armado óptimo con modos de línea ---------
   "equilibrado": un solo llamado al húngaro sobre los 8 huecos, sin
   favorecer ninguna línea — ya de por sí mejor que el llenado por
   niveles anterior porque considera todo el equipo a la vez.
   "priorizar_defensa" / "priorizar_ataque": la línea priorizada se
   resuelve PRIMERO contra TODA la plantilla disponible (así puede
   quedarse con el mejor candidato aunque sea un jugador "de otro
   palo"), y el resto de los huecos se resuelve después con quien
   quede. Ponderar el puntaje con un multiplicador simple no alcanzaba
   — la diferencia entre nivel exacto y estimación es demasiado grande
   — así que en vez de eso se cambia el ORDEN de resolución (ver
   sección 13.6 del traspaso, incluye el porqué del cambio de diseño). */
function assignMatchDayOptimal(available, formationKey, mode) {
  const formation = FORMATIONS[formationKey];
  const slotEntries = formation.slots.map((slot, origIdx) => ({ slot, origIdx }));
  let pool = available.map((rec, origIdx) => ({ rec, origIdx }));
  const result = new Array(formation.slots.length).fill(null);

  function resolveGroup(group) {
    if (!group.length) return;
    const { assigned, usedOrigIdx } = solveSlots(pool, group);
    assigned.forEach((a, k) => { if (a) result[group[k].origIdx] = a; });
    pool = pool.filter((p) => !usedOrigIdx.includes(p.origIdx));
  }

  if (mode === "priorizar_defensa") {
    resolveGroup(slotEntries.filter((s) => LINE_OF[s.slot.role] === "defensa"));
    resolveGroup(slotEntries.filter((s) => !result[s.origIdx]));
  } else if (mode === "priorizar_ataque") {
    resolveGroup(slotEntries.filter((s) => LINE_OF[s.slot.role] === "ataque"));
    resolveGroup(slotEntries.filter((s) => !result[s.origIdx]));
  } else {
    resolveGroup(slotEntries);
  }

  const filled = formation.slots.map((slot, i) => ({
    slot,
    player: result[i] ? result[i].rec : null,
    tier: result[i] ? result[i].tier : null,
    detail: result[i] ? result[i].detail : null,
    rating: result[i] ? result[i].rating : null,
  }));
  const bench = pool.map((p) => p.rec).sort((a, b) => (b.affinity || 0) - (a.affinity || 0));
  return { filled, bench };
}

// Promedio de encaje (0-100) de cada línea a partir de los huecos ya
// llenos — es la "puntuación general por línea" que pidió el usuario,
// para tener un resumen del equipo además del detalle hueco por hueco.
function lineRatings(filled) {
  const sums = { defensa: 0, medio: 0, ataque: 0 };
  const counts = { defensa: 0, medio: 0, ataque: 0 };
  filled.forEach((f) => {
    if (!f.player) return;
    const line = LINE_OF[f.slot.role];
    sums[line] += f.rating ?? 0;
    counts[line] += 1;
  });
  const out = {};
  ["defensa", "medio", "ataque"].forEach((line) => {
    out[line] = counts[line] ? Math.round(sums[line] / counts[line]) : null;
  });
  return out;
}

const MODE_ORDER = ["equilibrado", "priorizar_defensa", "priorizar_ataque", "manual"];
const MODE_LABEL = {
  equilibrado: "Equilibrado",
  priorizar_defensa: "Priorizar defensa",
  priorizar_ataque: "Priorizar ataque",
  manual: "Manual",
};

const REFERENCES = [
  { label: "Kuhn — The Hungarian Method for the Assignment Problem", url: "https://web.eecs.umich.edu/~pettie/matching/Kuhn-hungarian-assignment.pdf" },
  { label: "Fister et al. — Intelligent team formation and player selection (Applied Intelligence, 2023)", url: "https://link.springer.com/article/10.1007/s10489-023-05150-x" },
  { label: "Grianti — The Hungarian Algorithm: the quest for the best lineup for football teams", url: "https://andrea-grianti.medium.com/the-hungarian-algorithm-a-use-case-for-football-managers-2527ad3097ef" },
  { label: "Hungarian Algorithm for Assignment Problem — GeeksforGeeks", url: "https://www.geeksforgeeks.org/dsa/hungarian-algorithm-assignment-problem-set-1-introduction/" },
];

export default function App() {
  const [records, setRecords] = useState([]);
  const [available, setAvailable] = useState(() => new Set());
  const [formationKey, setFormationKey] = useState("1-3-3-1");
  const [mode, setMode] = useState("equilibrado");
  const [lineup, setLineup] = useState(() => FORMATIONS["1-3-3-1"].slots.map((slot) => ({ slot, player: null, tier: null, detail: null, rating: null })));
  const [armedKey, setArmedKey] = useState(null);
  const [swapFirst, setSwapFirst] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => /\.csv$/i.test(f.name));
    if (!files.length) { setError("Sube el CSV consolidado (.csv) que descargaste del panel de resultados."); return; }
    setError("");
    let pending = files.length;
    const collected = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target.result || "").replace(/^﻿/, "");
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        (parsed.data || []).forEach((row) => {
          const rec = rowToRecord(row);
          if (rec) collected.push(rec);
        });
        if (--pending === 0) merge(collected);
      };
      reader.onerror = () => { if (--pending === 0) merge(collected); };
      reader.readAsText(file);
    });
  }
  function handleText(text) {
    const clean = String(text || "").replace(/^﻿/, "");
    if (!clean.trim()) { setError("Pega el contenido del CSV consolidado en el recuadro."); return; }
    setError("");
    const parsed = Papa.parse(clean, { header: true, skipEmptyLines: true });
    const collected = [];
    (parsed.data || []).forEach((row) => { const rec = rowToRecord(row); if (rec) collected.push(rec); });
    merge(collected);
  }
  function merge(incoming) {
    if (!incoming.length) { setError("No encontré filas válidas del test en ese CSV."); return; }
    setRecords((prev) => {
      const seen = new Set(prev.map(sig));
      const merged = [...prev];
      incoming.forEach((r) => { if (!seen.has(sig(r))) { seen.add(sig(r)); merged.push(r); } });
      return merged;
    });
  }
  function clearAll() { setRecords([]); setAvailable(new Set()); setError(""); }
  function toggleAvailable(key) {
    setAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function removePlayer(key) {
    setRecords((prev) => prev.filter((r) => sig(r) !== key));
    setAvailable((prev) => { const next = new Set(prev); next.delete(key); return next; });
  }

  const roster = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => POSITIONS[a.posKey].num - POSITIONS[b.posKey].num || a.name.localeCompare(b.name));
    return arr;
  }, [records]);

  const availableRecords = useMemo(
    () => records.filter((r) => available.has(sig(r))),
    [records, available]
  );
  const computed = useMemo(() => {
    if (mode === "manual") return null;
    return assignMatchDayOptimal(availableRecords, formationKey, mode);
  }, [availableRecords, formationKey, mode]);

  // Al cambiar de alineación, el arreglo manual anterior ya no calza (huecos
  // distintos) — se reinicia vacío. Si en ese momento el modo es automático,
  // el efecto siguiente lo va a pisar enseguida con el resultado calculado.
  useEffect(() => {
    setLineup(FORMATIONS[formationKey].slots.map((slot) => ({ slot, player: null, tier: null, detail: null, rating: null })));
    setArmedKey(null);
    setSwapFirst(null);
  }, [formationKey]);

  // En cualquier modo automático, cada vez que cambian los convocados o el
  // modo, se vuelve a calcular y se reemplaza la alineación mostrada. Al
  // pasar a "manual" no se borra nada: queda lo último armado como punto de
  // partida para ajustar a mano.
  useEffect(() => {
    if (computed) setLineup(computed.filled);
  }, [computed]);

  function armPlayer(key) {
    setSwapFirst(null);
    setArmedKey((prev) => (prev === key ? null : key));
  }

  // El nivel (exacto/podio/estimación) de un jugador ubicado o intercambiado
  // a mano se calcula igual que el del armado automático — "manual" ya NO
  // es un nivel propio, es una marca aparte (`manual: true`) que solo dice
  // "esto lo tocó el entrenador", sin bajarle la etiqueta de confianza real.
  // Antes se le ponía "manual" a todo sin excepción, así que un jugador
  // puesto a mano en su posición exacta se veía (y puntuaba en el resumen
  // por línea) como si fuera una apuesta incierta — bug real, ver 13.8.
  function placeArmedAt(slotIdx) {
    const rec = availableRecords.find((r) => sig(r) === armedKey);
    if (!rec) { setArmedKey(null); return; }
    const fit = scoreFor(rec, lineup[slotIdx].slot);
    setLineup((prev) => {
      const next = prev.map((f) => (f.player && sig(f.player) === armedKey ? { ...f, player: null, tier: null, detail: null, rating: null, manual: false } : f));
      next[slotIdx] = { ...next[slotIdx], player: rec, tier: fit.tier, detail: fit.detail || null, rating: fit.rating, manual: true };
      return next;
    });
    setArmedKey(null);
  }

  function onSlotClick(slotIdx) {
    if (armedKey) { placeArmedAt(slotIdx); return; }
    if (!lineup[slotIdx].player) { setSwapFirst(null); return; }
    if (swapFirst === null) { setSwapFirst(slotIdx); return; }
    if (swapFirst === slotIdx) { setSwapFirst(null); return; }
    setLineup((prev) => {
      const next = [...prev];
      const a = next[swapFirst], b = next[slotIdx];
      const fitA = b.player ? scoreFor(b.player, a.slot) : null;
      const fitB = a.player ? scoreFor(a.player, b.slot) : null;
      next[swapFirst] = { ...a, player: b.player, tier: fitA ? fitA.tier : null, detail: fitA ? fitA.detail || null : null, rating: fitA ? fitA.rating : null, manual: !!b.player };
      next[slotIdx] = { ...b, player: a.player, tier: fitB ? fitB.tier : null, detail: fitB ? fitB.detail || null : null, rating: fitB ? fitB.rating : null, manual: !!a.player };
      return next;
    });
    setSwapFirst(null);
  }

  function clearSlot(slotIdx) {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIdx] = { ...next[slotIdx], player: null, tier: null, detail: null, rating: null };
      return next;
    });
    setSwapFirst(null);
  }

  function unplace(key) {
    const idx = lineup.findIndex((f) => f.player && sig(f.player) === key);
    if (idx !== -1) clearSlot(idx);
  }

  const ratings = useMemo(() => lineRatings(lineup), [lineup]);
  const placedKeys = useMemo(() => new Set(lineup.filter((f) => f.player).map((f) => sig(f.player))), [lineup]);

  const empty = records.length === 0;
  const emptySlots = lineup.filter((f) => !f.player).length;
  // Siempre a partir de `lineup` (la alineación que se ve en pantalla), no del
  // resultado crudo del húngaro — si no, un intercambio a mano en un modo
  // automático no se reflejaba acá: el jugador que entraba a la cancha seguía
  // apareciendo en esta lista y el que salía no aparecía (bug real, ver 13.10).
  const benchPlayers = availableRecords.filter((r) => !placedKeys.has(sig(r)));

  return (
    <div className="mp-root">
      <style>{CSS}</style>
      <div className="mp-wrap">
        <div className="mp-eyebrow">Día de partido · Fútbol 8</div>
        <h1 className="mp-title">Planificador de partido</h1>
        <p className="mp-lead">
          Sube el CSV consolidado que descargaste del panel de resultados, marca quién confirmó
          para este partido y arma la alineación solo con esos jugadores.
        </p>

        <label
          className={`mp-drop ${drag ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <input type="file" accept=".csv,text/csv,text/comma-separated-values" multiple
            className="mp-fileinput"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          <div className="mp-dropicon">＋</div>
          <div className="mp-droptext">Toca para elegir el consolidado <span>o arrástralo aquí</span></div>
        </label>

        <button className="mp-pastelink" onClick={() => setPasteMode((v) => !v)}>
          {pasteMode ? "Ocultar" : "¿No te deja adjuntar? Pega el CSV aquí"}
        </button>
        {pasteMode && (
          <div className="mp-paste">
            <textarea className="mp-textarea" rows={5} value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Abre el CSV consolidado, copia todo su contenido y pégalo aquí." />
            <button className="mp-cta" onClick={() => { handleText(pasteText); setPasteText(""); }}>Procesar texto</button>
          </div>
        )}
        {error && <div className="mp-error">{error}</div>}

        {!empty && (
          <>
            <div className="mp-cards">
              <Card label="En el CSV" value={records.length} />
              <Card label="Convocados" value={available.size} accent />
              <Card label="Posiciones convocadas" value={`${new Set(availableRecords.map((r) => r.posKey)).size}/6`} small />
            </div>

            <div className="mp-columns">
            <div className="mp-col-left">
            <Section title="Convocatoria">
              <p className="mp-note" style={{ marginTop: 0, marginBottom: 14 }}>
                Marca quién confirmó para este partido. Nadie empieza marcado.
              </p>
              <div className="mp-roster">
                {roster.map((r) => {
                  const key = sig(r);
                  const on = available.has(key);
                  const isOpen = expanded === key;
                  const isArmed = armedKey === key;
                  const isPlaced = placedKeys.has(key);
                  const rec = recommendationFor(r, r.podiumArr);
                  const hasProfile = !!(r.height || r.weight || r.foot || r.side);
                  return (
                    <div key={key}>
                      <div className={`mp-rosterrow ${on ? "on" : ""} ${isArmed ? "armed" : ""}`}>
                        <label className="mp-check">
                          <input type="checkbox" checked={on} onChange={() => toggleAvailable(key)} />
                          <span className="mp-checkbox" />
                        </label>
                        <span className="mp-rosterinfo" onClick={() => setExpanded(isOpen ? null : key)}>
                          <span className="mp-tag"><b>{POSITIONS[r.posKey].num}</b>{r.posName}{r.notation ? ` (${r.notation})` : ""}</span>
                          <span className="mp-rostername">{r.name}</span>
                        </span>
                        <span className={`mp-rosterprep ${prepTierClass(r.prepPct)}`}>
                          {r.prepPct != null ? `${r.prepPct}% prep.` : "—"}
                        </span>
                        {on && (
                          <button
                            className={`mp-armbtn ${isArmed ? "on" : ""}`}
                            title={isPlaced ? "Sacarlo de la cancha" : "Ubicar en un puesto de la pizarra"}
                            onClick={() => (isPlaced ? unplace(key) : armPlayer(key))}
                          >
                            {isPlaced ? "quitar de la cancha" : isArmed ? "cancelar" : "ubicar"}
                          </button>
                        )}
                        <button className="mp-removebtn-sm" title="Quitar del CSV" onClick={() => removePlayer(key)}>×</button>
                      </div>
                      {isOpen && (
                        <div className="mp-detail">
                          {r.podiumArr.length > 0 && (
                            <div className="mp-detail-block">
                              <div className="mp-detail-title">Podio de posiciones</div>
                              {r.podiumArr.map((p, j) => (
                                <div className="mp-podium-row" key={j}>
                                  <span className="mp-podium-name">{p.name}</span>
                                  <span className="mp-bar-track"><span className="mp-bar-fill" style={{ width: `${p.pct}%` }} /></span>
                                  <span className="mp-podium-val">{p.pct}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mp-detail-block">
                            <div className="mp-detail-title">Perfil físico</div>
                            {hasProfile ? (
                              <div className="mp-profile-grid">
                                <span><b>Altura</b> {r.height ? `${r.height} cm` : "—"}</span>
                                <span><b>Peso</b> {r.weight ? `${r.weight} kg` : "—"}</span>
                                <span><b>Pie dominante</b> {r.foot || "—"}</span>
                                <span><b>Banda</b> {r.side || "—"}</span>
                              </div>
                            ) : (
                              <p className="mp-note">No disponible — test de una versión anterior a esta función.</p>
                            )}
                          </div>
                          {rec && <div className={`mp-rectag mp-tier-${rec.tag}`}>{rec.text}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
            </div>

            <div className="mp-col-right">
            {armedKey && (() => {
              const armedRec = availableRecords.find((r) => sig(r) === armedKey);
              return armedRec ? (
                <div className="mp-armedbar">
                  <span>Ubicando a <b>{armedRec.name}</b> — tocá un puesto de la pizarra</span>
                  <button onClick={() => setArmedKey(null)}>Cancelar</button>
                </div>
              ) : null;
            })()}
            <Section title="Alineación">
              <div className="mp-toggle">
                {FORMATION_ORDER.map((f) => (
                  <button key={f} className={formationKey === f ? "on" : ""} onClick={() => setFormationKey(f)}>
                    {FORMATIONS[f].label}
                  </button>
                ))}
              </div>

              <div className="mp-modetoggle">
                {MODE_ORDER.map((m) => (
                  <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setArmedKey(null); setSwapFirst(null); }}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              {mode === "manual" && (
                <p className="mp-note" style={{ marginTop: 0, marginBottom: 14 }}>
                  Nada se arma solo: tocá "ubicar" junto a un convocado y después el puesto de la pizarra donde va.
                </p>
              )}
              {mode !== "manual" && (
                <p className="mp-note" style={{ marginTop: 0, marginBottom: 14 }}>
                  Armado automático. Podés ajustar cualquier puesto a mano: "ubicar" un convocado, o tocar dos jugadores de la pizarra para intercambiarlos.
                </p>
              )}

              {availableRecords.length === 0 ? (
                <p className="mp-note">Todavía no marcaste a nadie como convocado.</p>
              ) : (
                <>
                  <MatchPitch filled={lineup} onSlotClick={onSlotClick} armedActive={!!armedKey} swapFirst={swapFirst} />
                  <Bench players={benchPlayers} armedKey={armedKey} onArm={armPlayer} />
                  <Legend />

                  <div className="mp-ratings">
                    {["defensa", "medio", "ataque"].map((line) => (
                      <div className="mp-rating-card" key={line}>
                        <div className="mp-rating-label">{LINE_LABEL[line]}</div>
                        <div className={`mp-rating-value ${ratings[line] == null ? "" : ratings[line] >= 70 ? "mp-tier-great" : ratings[line] >= 45 ? "mp-tier-ok" : "mp-tier-low"}`}>
                          {ratings[line] != null ? `${ratings[line]}%` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {lineup.some((f) => f.tier === "podium" || f.tier === "estimate") && (
                    <div className="mp-adjustments">
                      <div className="mp-bench-title">Ajustes de posición</div>
                      {lineup.filter((f) => f.player && f.tier !== "exact").map((f, i) => (
                        <p className="mp-adjust-row" key={i}>
                          <b>{f.player.name}</b> ({f.player.posName}) jugando de <b>{POSITIONS[f.slot.role].name}</b>
                          {" — "}
                          <span className={f.tier === "podium" ? "mp-tier-podium-text" : "mp-tier-estimate-text"}>
                            {f.tier === "podium" ? "respaldado por el test" : "estimación por perfil, no validada por el test"}
                          </span>
                          {f.detail ? ` (${f.detail})` : ""}
                          {f.manual ? <span className="mp-tier-manual-text"> · ajustado a mano</span> : ""}
                        </p>
                      ))}
                    </div>
                  )}

                  {emptySlots > 0 && (
                    <p className="mp-note mp-warn">
                      {emptySlots} puesto{emptySlots === 1 ? "" : "s"} sin cubrir
                      {mode === "manual" ? ": todavía no ubicaste a nadie ahí." : ": no quedan convocados sin asignar suficientes para completar la alineación (no es un problema de posición, es que faltan jugadores confirmados)."}
                    </p>
                  )}
                </>
              )}
            </Section>

            <div className="mp-actions">
              <button className="mp-ghost" onClick={clearAll}>Vaciar</button>
            </div>
            </div>
            </div>

            <Section title="Metodología y referencias">
              <p className="mp-note" style={{ marginTop: 0 }}>
                El armado automático resuelve el emparejamiento jugador-puesto con el algoritmo húngaro
                (asignación óptima), y los modos "priorizar defensa/ataque" resuelven esa línea primero
                contra toda la convocatoria antes de completar el resto.
              </p>
              <ul className="mp-reflist">
                {REFERENCES.map((r, i) => (
                  <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a></li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, accent, small }) {
  return (
    <div className="mp-card">
      <div className="mp-card-label">{label}</div>
      <div className={`mp-card-value ${accent ? "acc" : ""} ${small ? "sm" : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mp-section">
      <div className="mp-section-title">{title}</div>
      {children}
    </div>
  );
}

function Legend() {
  return (
    <div className="mp-legend">
      <span><i className="mp-dot mp-dot-exact" /> Titular directo</span>
      <span><i className="mp-dot mp-dot-podium" /> Movido, respaldado por el test</span>
      <span><i className="mp-dot mp-dot-estimate" /> Movido, estimación por perfil</span>
      <span><i className="mp-dot mp-dot-manualring" /> Tocado a mano (el color sigue mostrando el nivel real)</span>
    </div>
  );
}

function MatchPitch({ filled, onSlotClick, armedActive, swapFirst }) {
  return (
    <div className="mp-pitchwrap">
      <svg viewBox="0 0 100 150" className={`mp-pitch ${armedActive ? "arming" : ""}`} role="img" aria-label="Alineación del partido">
        <rect x="3" y="3" width="94" height="144" className="pl" />
        <line x1="3" y1="75" x2="97" y2="75" className="pl" />
        <circle cx="50" cy="75" r="11" className="pl" />
        <circle cx="50" cy="75" r="1.2" className="plf" />
        <rect x="26" y="126" width="48" height="21" className="pl" />
        <rect x="38" y="140" width="24" height="7" className="pl" />
        <rect x="26" y="3" width="48" height="21" className="pl" />
        <rect x="38" y="3" width="24" height="7" className="pl" />
        {filled.map(({ slot, player, tier, manual }, i) => {
          const [cx, cy] = slot.coord;
          const has = !!player;
          const tierCls = tier === "podium" ? "mk-podium" : tier === "estimate" ? "mk-estimate" : "";
          const cls = `mk ${has ? "on" : ""} ${tierCls} ${manual ? "mk-manualtouch" : ""} ${swapFirst === i ? "selected" : ""}`;
          return (
            <g key={i} className={cls} onClick={() => onSlotClick(i)} style={{ cursor: "pointer" }}>
              {has && <circle cx={cx} cy={cy} r="8" className="mk-halo" />}
              <circle cx={cx} cy={cy} r="6" className="mk-dot" />
              <text x={cx} y={cy + 1.8} className="mk-code">{slot.code}</text>
              <text x={cx} y={cy + (has ? 10.5 : 9.5)} className="mk-name">
                {has ? (player.name.length > 12 ? player.name.slice(0, 11) + "…" : player.name) : "vacío"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Los de banca son clicables: tocar uno lo "arma" (mismo mecanismo que el
// botón "ubicar" de la Convocatoria) y después se toca el puesto de la
// pizarra que se quiere ocupar — quien estuviera ahí vuelve a esta lista
// automáticamente. Antes esta lista era solo texto: había que volver a
// subir hasta la Convocatoria para ubicar a alguien que ya se veía acá.
function Bench({ players, armedKey, onArm }) {
  if (!players.length) return null;
  return (
    <div className="mp-bench">
      <div className="mp-bench-title">Suplentes ({players.length})</div>
      <p className="mp-note" style={{ marginTop: 0, marginBottom: 10 }}>
        Tocá a uno para ubicarlo, después tocá en la pizarra el puesto que va a ocupar.
      </p>
      <div className="mp-bench-list">
        {players.map((p, i) => {
          const key = sig(p);
          const isArmed = armedKey === key;
          return (
            <button
              type="button"
              className={`mp-bench-item ${isArmed ? "armed" : ""}`}
              key={i}
              onClick={() => onArm(key)}
              title={isArmed ? "Cancelar" : "Ubicar en un puesto de la pizarra"}
            >
              {p.name} <b>{POSITIONS[p.posKey].num}</b> {p.posName}{p.affinity != null ? ` · ${p.affinity}%` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
.mp-root{
  --bg:#0b140f; --panel:#111e17; --line:#2c4f3d; --chalk:#eef1ea;
  --dim:#8ba192; --accent:#e8b84b; --green:#4cc38a; --red:#e5555a; --blue:#5aa8e0;
  min-height:100vh; background:radial-gradient(120% 80% at 50% -10%, #12241a 0%, var(--bg) 60%);
  color:var(--chalk); font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  display:flex; justify-content:center; padding:28px 18px 56px;
}
.mp-wrap{ width:100%; max-width:640px; }
.mp-eyebrow{ font-family:'Oswald'; letter-spacing:.22em; text-transform:uppercase; font-size:12px; color:var(--accent); font-weight:600; margin-bottom:12px; }
.mp-title{ font-family:'Oswald'; font-weight:700; text-transform:uppercase; font-size:clamp(28px,7vw,40px); line-height:1; margin:0 0 14px; }
.mp-lead{ color:var(--dim); font-size:15px; line-height:1.6; margin:0 0 24px; }

.mp-drop{ position:relative; display:block; border:1.6px dashed var(--line); border-radius:16px; background:var(--panel);
  padding:30px 20px; text-align:center; cursor:pointer; transition:.18s; }
.mp-drop:hover,.mp-drop.over{ border-color:var(--accent); background:#14241b; }
.mp-fileinput{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.mp-dropicon{ font-size:30px; color:var(--accent); font-weight:300; line-height:1; margin-bottom:10px; }
.mp-droptext{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.08em; font-size:15px; }
.mp-droptext span{ display:block; font-family:'Inter'; text-transform:none; letter-spacing:0; color:var(--dim); font-size:13px; margin-top:4px; }
.mp-pastelink{ display:block; width:100%; background:transparent; border:none; color:var(--dim);
  font-size:13px; padding:12px; margin-top:6px; cursor:pointer; text-decoration:underline; }
.mp-pastelink:hover{ color:var(--accent); }
.mp-paste{ margin-top:4px; display:flex; flex-direction:column; gap:10px; }
.mp-textarea{ width:100%; box-sizing:border-box; background:var(--panel); border:1.5px solid var(--line);
  color:var(--chalk); border-radius:12px; padding:13px; font-family:ui-monospace,monospace; font-size:12.5px; resize:vertical; outline:none; }
.mp-textarea:focus{ border-color:var(--accent); }
.mp-error{ margin-top:14px; color:#e8b84b; background:#241d10; border:1px solid #4a3c18; padding:12px 14px; border-radius:11px; font-size:13.5px; }

.mp-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:24px 0 10px; }
.mp-card{ background:var(--panel); border:1.5px solid var(--line); border-radius:14px; padding:16px 14px; }
.mp-card-label{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.12em; font-size:11px; color:var(--dim); margin-bottom:8px; }
.mp-card-value{ font-family:'Oswald'; font-weight:700; font-size:30px; line-height:1; }
.mp-card-value.acc{ color:var(--accent); }
.mp-card-value.sm{ font-size:20px; }

.mp-section{ background:var(--panel); border:1.5px solid var(--line); border-radius:16px; padding:20px; margin-bottom:16px; }
.mp-section-title{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.14em; font-size:12.5px; color:var(--accent); margin-bottom:16px; }
.mp-note{ color:var(--dim); font-size:13px; line-height:1.55; margin:14px 0 0; }
.mp-note.mp-warn{ color:var(--red); }

.mp-tier-great{ color:var(--green); font-weight:600; }
.mp-tier-good{ color:var(--chalk); }
.mp-tier-ok{ color:var(--accent); font-weight:600; }
.mp-tier-low{ color:var(--red); font-weight:600; }

.mp-roster{ display:flex; flex-direction:column; gap:8px; }
.mp-rosterrow{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; border:1px solid var(--line); background:#0d1913; }
.mp-rosterrow.on{ border-color:var(--accent); background:#182517; }
.mp-check{ position:relative; display:flex; align-items:center; cursor:pointer; flex:none; }
.mp-check input{ position:absolute; opacity:0; width:20px; height:20px; margin:0; cursor:pointer; }
.mp-checkbox{ width:19px; height:19px; border-radius:6px; border:1.5px solid var(--line); background:#0b140f; display:block; }
.mp-check input:checked + .mp-checkbox{ background:var(--accent); border-color:var(--accent); }
.mp-rosterinfo{ flex:1; display:flex; flex-direction:column; gap:2px; cursor:pointer; min-width:0; }
.mp-rostername{ font-size:13.5px; }
.mp-rosterprep{ font-family:'Oswald'; font-size:11px; flex:none; width:64px; text-align:right; }
.mp-removebtn-sm{ flex:none; background:transparent; border:none; color:var(--dim); font-size:18px; line-height:1; cursor:pointer; padding:2px 4px; }
.mp-removebtn-sm:hover{ color:var(--red); }
.mp-tag{ display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:var(--dim); }
.mp-tag b{ font-family:'Oswald'; font-size:11px; background:#1c3527; color:var(--accent); border-radius:5px; padding:1px 6px; }

.mp-toggle,.mp-modetoggle{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
.mp-toggle button,.mp-modetoggle button{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.04em;
  font-size:10.5px; padding:10px 4px; border-radius:9px; cursor:pointer;
  background:#0d1913; color:var(--dim); border:1.5px solid var(--line); transition:.18s; }
.mp-toggle button.on,.mp-modetoggle button.on{ color:#0b140f; background:var(--accent); border-color:var(--accent); font-weight:600; }
.mp-modetoggle{ margin-bottom:6px; }

.mp-ratings{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:16px 0; }
.mp-rating-card{ background:#0d1913; border:1px solid var(--line); border-radius:12px; padding:12px; text-align:center; }
.mp-rating-label{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.1em; font-size:10.5px; color:var(--dim); margin-bottom:6px; }
.mp-rating-value{ font-family:'Oswald'; font-weight:700; font-size:22px; color:var(--chalk); }

.mp-armbtn{ flex:none; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.03em; font-size:9.5px;
  padding:6px 8px; border-radius:7px; cursor:pointer; background:transparent; color:var(--dim); border:1.5px solid var(--line); white-space:nowrap; }
.mp-armbtn.on{ background:var(--accent); color:#0b140f; border-color:var(--accent); }
.mp-rosterrow.armed{ border-color:var(--accent); }

.mp-detail{ padding:14px 10px 16px; margin:2px 0 0; background:#0d1913; border:1px solid var(--line); border-top:none; border-radius:0 0 10px 10px; display:flex; flex-direction:column; gap:14px; }
.mp-detail-block{ display:flex; flex-direction:column; gap:6px; }
.mp-detail-title{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.1em; font-size:10.5px; color:var(--dim); }
.mp-podium-row{ display:flex; align-items:center; gap:9px; }
.mp-podium-name{ font-size:12.5px; width:130px; flex:none; }
.mp-podium-val{ font-family:'Oswald'; font-size:12px; width:34px; text-align:right; }
.mp-profile-grid{ display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:12.5px; color:var(--chalk); }
.mp-profile-grid b{ color:var(--dim); font-weight:500; margin-right:5px; }
.mp-rectag{ align-self:flex-start; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.04em; font-size:11px;
  padding:6px 12px; border-radius:8px; background:#182b20; border:1px solid var(--line); }

.mp-reflist{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.mp-reflist a{ color:var(--blue); font-size:12.5px; text-decoration:underline; line-height:1.5; }
.mp-reflist a:hover{ color:var(--accent); }

.mp-pitchwrap{ display:flex; justify-content:center; }
.mp-pitch{ width:100%; max-width:300px; }
.mp-pitch .pl{ fill:none; stroke:#3a6b52; stroke-width:.8; }
.mp-pitch .plf{ fill:#3a6b52; stroke:none; }
.mp-pitch .mk-dot{ fill:#182b20; stroke:#3a6b52; stroke-width:1; }
.mp-pitch .mk-code{ fill:var(--dim); font-family:'Oswald'; font-size:4.6px; text-anchor:middle; font-weight:600; }
.mp-pitch .mk-name{ fill:var(--dim); font-family:'Inter'; font-size:3.6px; text-anchor:middle; }
.mp-pitch .mk.on .mk-dot{ fill:var(--accent); stroke:var(--accent); }
.mp-pitch .mk.on .mk-code{ fill:#0b140f; }
.mp-pitch .mk.on .mk-name{ fill:var(--chalk); font-weight:600; }
.mp-pitch .mk-halo{ fill:var(--accent); opacity:.18; }
.mp-pitch .mk.mk-podium .mk-dot{ fill:var(--blue); stroke:var(--blue); }
.mp-pitch .mk.mk-podium .mk-halo{ fill:var(--blue); opacity:.18; }
.mp-pitch .mk.mk-estimate .mk-dot{ fill:var(--red); stroke:var(--red); }
.mp-pitch .mk.mk-estimate .mk-halo{ fill:var(--red); opacity:.18; }
.mp-pitch .mk.mk-manualtouch .mk-dot{ stroke-width:2; stroke:#b98af0; stroke-dasharray:2,1.5; }
.mp-pitch .mk.selected .mk-dot{ stroke-width:2; stroke:var(--chalk); }
.mp-pitch.arming .mk{ cursor:crosshair; }

.mp-legend{ display:flex; flex-wrap:wrap; gap:14px; justify-content:center; margin-top:12px; font-size:11.5px; color:var(--dim); }
.mp-legend span{ display:inline-flex; align-items:center; gap:6px; }
.mp-dot{ width:9px; height:9px; border-radius:50%; display:inline-block; }
.mp-dot-exact{ background:var(--accent); }
.mp-dot-podium{ background:var(--blue); }
.mp-dot-estimate{ background:var(--red); }
.mp-dot-manualring{ background:transparent; border:2px dashed #b98af0; width:8px; height:8px; }

.mp-adjustments{ margin-top:16px; padding-top:14px; border-top:1px solid #1a2b20; }
.mp-adjust-row{ font-size:12.5px; color:var(--chalk); line-height:1.6; margin:0 0 6px; }
.mp-tier-podium-text{ color:var(--blue); }
.mp-tier-estimate-text{ color:var(--red); }
.mp-tier-manual-text{ color:#b98af0; }

.mp-bench{ margin-top:16px; padding-top:14px; border-top:1px solid #1a2b20; }
.mp-bench-title{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.1em; font-size:11px; color:var(--dim); margin-bottom:10px; }
.mp-bench-list{ display:flex; flex-wrap:wrap; gap:8px; }
.mp-bench-item{ background:#0d1913; border:1px solid var(--line); border-radius:8px; padding:6px 10px; font-size:12px; color:var(--chalk); font-family:'Inter'; cursor:pointer; transition:border-color .15s, background .15s; }
.mp-bench-item:hover{ border-color:var(--accent); }
.mp-bench-item.armed{ background:var(--accent); border-color:var(--accent); color:#1a1408; }
.mp-bench-item b{ color:var(--accent); font-family:'Oswald'; }
.mp-bench-item.armed b{ color:#1a1408; }

.mp-actions{ display:flex; gap:10px; margin-top:8px; }
.mp-cta{ flex:1; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.09em; font-size:15px; font-weight:600;
  padding:15px; border:none; border-radius:12px; cursor:pointer; background:var(--accent); color:#0b140f; transition:.18s; }
.mp-cta:hover{ filter:brightness(1.06); }
.mp-ghost{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.09em; font-size:14px; padding:15px 20px;
  border:1.5px solid var(--line); border-radius:12px; cursor:pointer; background:transparent; color:var(--chalk); }
.mp-ghost:hover{ border-color:var(--dim); }

@media (max-width:480px){ .mp-cards{ gap:8px; } .mp-card-value{ font-size:22px; } }

/* En escritorio, convocatoria y pizarra van lado a lado en vez de apiladas:
   así el modo manual (ubicar un convocado -> tocar un puesto) no obliga a
   hacer scroll de un lado a otro de la pantalla. */
.mp-armedbar{ position:sticky; top:12px; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:var(--accent); color:#0b140f; padding:11px 14px; border-radius:11px; margin-bottom:14px;
  font-size:13px; font-weight:600; box-shadow:0 6px 20px rgba(0,0,0,.35); }
.mp-armedbar b{ font-family:'Oswald'; }
.mp-armedbar button{ flex:none; background:transparent; border:1.5px solid rgba(11,20,15,.4); color:#0b140f;
  border-radius:7px; padding:5px 11px; cursor:pointer; font-family:'Oswald'; text-transform:uppercase; font-size:11px; letter-spacing:.04em; }
.mp-armedbar button:hover{ background:rgba(11,20,15,.12); }

@media (min-width:980px){
  .mp-wrap{ max-width:1080px; }
  .mp-columns{ display:grid; grid-template-columns:minmax(320px,400px) 1fr; gap:22px; align-items:start; }
  .mp-col-left{ min-width:0; }
  .mp-col-right{ min-width:0; position:sticky; top:20px; }
}
`;
