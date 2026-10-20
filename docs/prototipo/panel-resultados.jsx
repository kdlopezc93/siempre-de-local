import { useState, useMemo, useRef } from "react";
import Papa from "papaparse";

/* ============================================================
   PANEL DE RESULTADOS — consolida los CSV del test de posición
   ============================================================ */

const POSITIONS = {
  POR: { name: "Portero", num: 1, x: 50, y: 139 },
  LAT: { name: "Lateral", num: 2, x: 20, y: 113 },
  DFC: { name: "Defensa central", num: 4, x: 50, y: 116 },
  MCD: { name: "Pivote", num: 6, x: 50, y: 97 },
  MC:  { name: "Mediocentro", num: 8, x: 64, y: 80 },
  MP:  { name: "Mediapunta", num: 10, x: 36, y: 60 },
  EXT: { name: "Extremo", num: 7, x: 80, y: 64 },
  DC:  { name: "Delantero centro", num: 9, x: 50, y: 36 },
};
const ORDER = ["POR", "LAT", "DFC", "MCD", "MC", "MP", "EXT", "DC"];
const NAME_TO_KEY = Object.fromEntries(
  Object.entries(POSITIONS).map(([k, v]) => [v.name.toLowerCase(), k])
);

/* --------- utilidades de parseo --------- */
function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/[_%]/g, "");
}
function getField(row, ...names) {
  const targets = names.map(norm);
  for (const key of Object.keys(row)) {
    if (targets.includes(norm(key))) return row[key];
  }
  return "";
}
function parsePrepFraction(v) {
  // "7/8" -> {n:7, d:8}
  const m = String(v || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { n: +m[1], d: +m[2] };
  return null;
}

function rowToRecord(row) {
  const posName = getField(row, "Posicion", "Posición");
  const key = NAME_TO_KEY[String(posName).trim().toLowerCase()];
  if (!key) return null; // fila que no encaja con el formato del test
  const prepFrac = parsePrepFraction(getField(row, "Preparacion", "Preparación"));
  const prepPct = parseFloat(getField(row, "Preparacion_%", "Preparación_%")) ||
    (prepFrac ? Math.round((prepFrac.n / prepFrac.d) * 100) : null);
  return {
    name: (getField(row, "Nombre") || "Anónimo").trim(),
    date: (getField(row, "Fecha") || "").trim(),
    format: (getField(row, "Formato") || "").trim(),
    posKey: key,
    posName: POSITIONS[key].name,
    affinity: parseFloat(getField(row, "Afinidad_%", "Afinidad")) || null,
    podium: (getField(row, "Podio") || "").trim(),
    prepN: prepFrac ? prepFrac.n : null,
    prepD: prepFrac ? prepFrac.d : 8,
    prepPct,
  };
}

function sig(r) { return `${r.name}|${r.date}|${r.posKey}`; }

export default function App() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => /\.csv$/i.test(f.name));
    if (!files.length) { setError("Sube archivos .csv exportados desde el test."); return; }
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
    if (!clean.trim()) { setError("Pega el contenido del CSV en el recuadro."); return; }
    setError("");
    const parsed = Papa.parse(clean, { header: true, skipEmptyLines: true });
    const collected = [];
    (parsed.data || []).forEach((row) => { const rec = rowToRecord(row); if (rec) collected.push(rec); });
    merge(collected);
  }

  function merge(incoming) {
    if (!incoming.length) { setError("No encontré filas válidas del test en esos archivos."); return; }
    setRecords((prev) => {
      const seen = new Set(prev.map(sig));
      const merged = [...prev];
      incoming.forEach((r) => { if (!seen.has(sig(r))) { seen.add(sig(r)); merged.push(r); } });
      return merged;
    });
  }

  function clearAll() { setRecords([]); setError(""); }

  /* --------- agregados --------- */
  const stats = useMemo(() => {
    const byPos = Object.fromEntries(ORDER.map((k) => [k, 0]));
    const prepByPos = Object.fromEntries(ORDER.map((k) => [k, []]));
    let f8 = 0, f11 = 0, prepSum = 0, prepCount = 0;
    records.forEach((r) => {
      byPos[r.posKey]++;
      if (/8/.test(r.format)) f8++; else if (/11/.test(r.format)) f11++;
      if (r.prepPct != null) { prepSum += r.prepPct; prepCount++; prepByPos[r.posKey].push(r.prepPct); }
    });
    const maxPos = Math.max(1, ...Object.values(byPos));
    const avgPrep = prepCount ? Math.round(prepSum / prepCount) : null;
    return { byPos, prepByPos, f8, f11, avgPrep, maxPos };
  }, [records]);

  const sorted = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "pos": av = POSITIONS[a.posKey].num; bv = POSITIONS[b.posKey].num; break;
        case "affinity": av = a.affinity || 0; bv = b.affinity || 0; break;
        case "prep": av = a.prepPct || 0; bv = b.prepPct || 0; break;
        case "format": av = a.format; bv = b.format; break;
        default: av = a.name.toLowerCase(); bv = b.name.toLowerCase();
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return arr;
  }, [records, sortKey, sortDir]);

  function toggleSort(k) {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(1); }
  }

  function exportCSV() {
    const head = ["Nombre", "Fecha", "Formato", "Posicion", "Afinidad_%", "Preparacion", "Preparacion_%", "Podio"];
    const rows = sorted.map((r) => [
      r.name, r.date, r.format, r.posName, r.affinity ?? "",
      r.prepN != null ? `${r.prepN}/${r.prepD}` : "", r.prepPct ?? "", r.podium,
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla_consolidada.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const empty = records.length === 0;
  const gaps = ORDER.filter((k) => stats.byPos[k] === 0);

  return (
    <div className="pr-root">
      <style>{CSS}</style>
      <div className="pr-wrap">
        <div className="pr-eyebrow">Análisis de plantilla</div>
        <h1 className="pr-title">Panel de resultados</h1>
        <p className="pr-lead">Sube los CSV que descargaron tus jugadores en el test. Puedes soltar varios a la vez; se acumulan y se descartan los repetidos.</p>

        <label
          className={`pr-drop ${drag ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <input type="file" accept=".csv,text/csv,text/comma-separated-values" multiple
            className="pr-fileinput"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          <div className="pr-dropicon">＋</div>
          <div className="pr-droptext">Toca para elegir los CSV <span>o arrástralos aquí</span></div>
        </label>

        <button className="pr-pastelink" onClick={() => setPasteMode((v) => !v)}>
          {pasteMode ? "Ocultar" : "¿No te deja adjuntar? Pega el CSV aquí"}
        </button>
        {pasteMode && (
          <div className="pr-paste">
            <textarea className="pr-textarea" rows={5} value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Abre el CSV, copia todo su contenido y pégalo aquí. Puedes pegar varios seguidos." />
            <button className="pr-cta" onClick={() => { handleText(pasteText); setPasteText(""); }}>Procesar texto</button>
          </div>
        )}
        {error && <div className="pr-error">{error}</div>}

        {!empty && (
          <>
            <div className="pr-cards">
              <Card label="Jugadores" value={records.length} />
              <Card label="Preparación media" value={stats.avgPrep != null ? `${stats.avgPrep}%` : "—"} accent />
              <Card label="Formato" value={`${stats.f11} · 11 / ${stats.f8} · 8`} small />
            </div>

            <Section title="Dónde encaja tu plantilla">
              <SquadPitch byPos={stats.byPos} max={stats.maxPos} />
              {gaps.length > 0 && (
                <p className="pr-note">
                  Sin nadie: {gaps.map((k) => POSITIONS[k].name).join(", ")}. Son los huecos de tu plantilla según el test.
                </p>
              )}
            </Section>

            <Section title="Reparto por posición">
              {ORDER.map((k) => (
                <div className="pr-bar-row" key={k}>
                  <span className="pr-bar-num">{POSITIONS[k].num}</span>
                  <span className="pr-bar-name">{POSITIONS[k].name}</span>
                  <span className="pr-bar-track">
                    <span className="pr-bar-fill" style={{ width: `${(stats.byPos[k] / stats.maxPos) * 100}%` }} />
                  </span>
                  <span className="pr-bar-val">{stats.byPos[k]}</span>
                </div>
              ))}
            </Section>

            <Section title="Detalle de jugadores">
              <div className="pr-tablewrap">
                <table className="pr-table">
                  <thead>
                    <tr>
                      <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Nombre</Th>
                      <Th onClick={() => toggleSort("pos")} active={sortKey === "pos"} dir={sortDir}>Posición</Th>
                      <Th onClick={() => toggleSort("affinity")} active={sortKey === "affinity"} dir={sortDir} r>Afinidad</Th>
                      <Th onClick={() => toggleSort("prep")} active={sortKey === "prep"} dir={sortDir} r>Prep.</Th>
                      <Th onClick={() => toggleSort("format")} active={sortKey === "format"} dir={sortDir}>Formato</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td><span className="pr-tag"><b>{POSITIONS[r.posKey].num}</b>{r.posName}</span></td>
                        <td className="r">{r.affinity != null ? `${r.affinity}%` : "—"}</td>
                        <td className="r">{r.prepN != null ? `${r.prepN}/${r.prepD}` : "—"}</td>
                        <td className="pr-dim">{r.format || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="pr-actions">
              <button className="pr-cta" onClick={exportCSV}>Descargar consolidado (CSV)</button>
              <button className="pr-ghost" onClick={clearAll}>Vaciar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, accent, small }) {
  return (
    <div className="pr-card">
      <div className="pr-card-label">{label}</div>
      <div className={`pr-card-value ${accent ? "acc" : ""} ${small ? "sm" : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="pr-section">
      <div className="pr-section-title">{title}</div>
      {children}
    </div>
  );
}

function Th({ children, onClick, active, dir, r }) {
  return (
    <th onClick={onClick} className={`${r ? "r" : ""} ${active ? "active" : ""}`}>
      {children}{active ? (dir > 0 ? " ↑" : " ↓") : ""}
    </th>
  );
}

function SquadPitch({ byPos, max }) {
  return (
    <div className="pr-pitchwrap">
      <svg viewBox="0 0 100 150" className="pr-pitch" role="img" aria-label="Reparto de la plantilla en el campo">
        <rect x="3" y="3" width="94" height="144" className="pl" />
        <line x1="3" y1="75" x2="97" y2="75" className="pl" />
        <circle cx="50" cy="75" r="11" className="pl" />
        <circle cx="50" cy="75" r="1.2" className="plf" />
        <rect x="26" y="126" width="48" height="21" className="pl" />
        <rect x="38" y="140" width="24" height="7" className="pl" />
        <rect x="26" y="3" width="48" height="21" className="pl" />
        <rect x="38" y="3" width="24" height="7" className="pl" />
        {ORDER.map((k) => {
          const p = POSITIONS[k];
          const n = byPos[k];
          const t = n / max; // 0..1
          const rad = 4.5 + t * 5.5;
          const has = n > 0;
          return (
            <g key={k} className={has ? "mk on" : "mk"}>
              {has && <circle cx={p.x} cy={p.y} r={rad + 2.5} className="mk-halo" style={{ opacity: 0.15 + t * 0.35 }} />}
              <circle cx={p.x} cy={p.y} r={has ? rad : 4} className="mk-dot" />
              <text x={p.x} y={p.y + 2.1} className="mk-num">{p.num}</text>
              {has && <text x={p.x} y={p.y - rad - 2} className="mk-count">{n}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
.pr-root{
  --bg:#0b140f; --panel:#111e17; --line:#2c4f3d; --chalk:#eef1ea;
  --dim:#8ba192; --accent:#e8b84b; --green:#4cc38a;
  min-height:100vh; background:radial-gradient(120% 80% at 50% -10%, #12241a 0%, var(--bg) 60%);
  color:var(--chalk); font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  display:flex; justify-content:center; padding:28px 18px 56px;
}
.pr-wrap{ width:100%; max-width:640px; }
.pr-eyebrow{ font-family:'Oswald'; letter-spacing:.22em; text-transform:uppercase; font-size:12px; color:var(--accent); font-weight:600; margin-bottom:12px; }
.pr-title{ font-family:'Oswald'; font-weight:700; text-transform:uppercase; font-size:clamp(30px,7vw,44px); line-height:1; margin:0 0 14px; }
.pr-lead{ color:var(--dim); font-size:15px; line-height:1.6; margin:0 0 24px; }

.pr-drop{ position:relative; display:block; border:1.6px dashed var(--line); border-radius:16px; background:var(--panel);
  padding:30px 20px; text-align:center; cursor:pointer; transition:.18s; }
.pr-drop:hover,.pr-drop.over{ border-color:var(--accent); background:#14241b; }
.pr-fileinput{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.pr-dropicon{ font-size:30px; color:var(--accent); font-weight:300; line-height:1; margin-bottom:10px; }
.pr-droptext{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.08em; font-size:15px; }
.pr-droptext span{ display:block; font-family:'Inter'; text-transform:none; letter-spacing:0; color:var(--dim); font-size:13px; margin-top:4px; }
.pr-pastelink{ display:block; width:100%; background:transparent; border:none; color:var(--dim);
  font-size:13px; padding:12px; margin-top:6px; cursor:pointer; text-decoration:underline; }
.pr-pastelink:hover{ color:var(--accent); }
.pr-paste{ margin-top:4px; display:flex; flex-direction:column; gap:10px; }
.pr-textarea{ width:100%; box-sizing:border-box; background:var(--panel); border:1.5px solid var(--line);
  color:var(--chalk); border-radius:12px; padding:13px; font-family:ui-monospace,monospace; font-size:12.5px; resize:vertical; outline:none; }
.pr-textarea:focus{ border-color:var(--accent); }
.pr-error{ margin-top:14px; color:#e8b84b; background:#241d10; border:1px solid #4a3c18; padding:12px 14px; border-radius:11px; font-size:13.5px; }

.pr-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:24px 0; }
.pr-card{ background:var(--panel); border:1.5px solid var(--line); border-radius:14px; padding:16px 14px; }
.pr-card-label{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.12em; font-size:11px; color:var(--dim); margin-bottom:8px; }
.pr-card-value{ font-family:'Oswald'; font-weight:700; font-size:30px; line-height:1; }
.pr-card-value.acc{ color:var(--accent); }
.pr-card-value.sm{ font-size:17px; }

.pr-section{ background:var(--panel); border:1.5px solid var(--line); border-radius:16px; padding:20px; margin-bottom:16px; }
.pr-section-title{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.14em; font-size:12.5px; color:var(--accent); margin-bottom:16px; }
.pr-note{ color:var(--dim); font-size:13px; line-height:1.55; margin:14px 0 0; }

.pr-pitchwrap{ display:flex; justify-content:center; }
.pr-pitch{ width:100%; max-width:270px; }
.pr-pitch .pl{ fill:none; stroke:#3a6b52; stroke-width:.8; }
.pr-pitch .plf{ fill:#3a6b52; stroke:none; }
.pr-pitch .mk-dot{ fill:#182b20; stroke:#3a6b52; stroke-width:1; }
.pr-pitch .mk-num{ fill:var(--dim); font-family:'Oswald'; font-size:5.5px; text-anchor:middle; font-weight:600; }
.pr-pitch .mk-count{ fill:var(--accent); font-family:'Oswald'; font-size:6px; text-anchor:middle; font-weight:700; }
.pr-pitch .mk.on .mk-dot{ fill:var(--accent); stroke:var(--accent); }
.pr-pitch .mk.on .mk-num{ fill:#0b140f; }
.pr-pitch .mk-halo{ fill:var(--accent); }

.pr-bar-row{ display:flex; align-items:center; gap:11px; margin-bottom:12px; }
.pr-bar-num{ font-family:'Oswald'; font-weight:700; font-size:13px; color:var(--dim); width:16px; text-align:center; }
.pr-bar-name{ font-size:13.5px; width:120px; flex:none; }
.pr-bar-track{ flex:1; height:8px; background:#0d1913; border-radius:99px; overflow:hidden; }
.pr-bar-fill{ display:block; height:100%; background:var(--green); border-radius:99px; transition:width .4s ease; }
.pr-bar-val{ font-family:'Oswald'; font-size:14px; width:26px; text-align:right; }

.pr-tablewrap{ overflow-x:auto; margin:0 -4px; }
.pr-table{ width:100%; border-collapse:collapse; font-size:13.5px; }
.pr-table th{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.06em; font-size:11px; color:var(--dim);
  text-align:left; padding:8px 10px; border-bottom:1.5px solid var(--line); cursor:pointer; white-space:nowrap; user-select:none; }
.pr-table th.active{ color:var(--accent); }
.pr-table th.r,.pr-table td.r{ text-align:right; }
.pr-table td{ padding:10px; border-bottom:1px solid #1a2b20; }
.pr-table td.pr-dim{ color:var(--dim); }
.pr-tag{ display:inline-flex; align-items:center; gap:7px; }
.pr-tag b{ font-family:'Oswald'; font-size:11px; background:#1c3527; color:var(--accent); border-radius:5px; padding:1px 6px; }

.pr-actions{ display:flex; gap:10px; margin-top:8px; }
.pr-cta{ flex:1; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.09em; font-size:15px; font-weight:600;
  padding:15px; border:none; border-radius:12px; cursor:pointer; background:var(--accent); color:#0b140f; transition:.18s; }
.pr-cta:hover{ filter:brightness(1.06); }
.pr-ghost{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.09em; font-size:14px; padding:15px 20px;
  border:1.5px solid var(--line); border-radius:12px; cursor:pointer; background:transparent; color:var(--chalk); }
.pr-ghost:hover{ border-color:var(--dim); }

@media (max-width:480px){ .pr-bar-name{ width:96px; } .pr-cards{ gap:8px; } .pr-card-value{ font-size:24px; } }
`;
