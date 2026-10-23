import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { SoccerBall } from '@phosphor-icons/react/dist/csr/SoccerBall';
import { Strategy } from '@phosphor-icons/react/dist/csr/Strategy';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { POSITIONS, positionAverages, type PositionCode } from '@sdl/domain';
import { useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router';

import { BottomNav } from '../../shared/ui/BottomNav';
import { Button } from '../../shared/ui/Button';
import { Chips } from '../../shared/ui/Chips';
import { Row } from '../../shared/ui/Row';
import { Sheet } from '../../shared/ui/Sheet';
import { LeadTask, TaskRow } from '../../shared/ui/TaskCard';
import { TeamHeader } from '../../shared/ui/TeamHeader';
import { lineOfPosition, Token, type TokenLine } from '../../shared/ui/Token';
import { PlayerCard } from '../card/PlayerCard';
import { ExamBoard } from '../knowledge/ExamBoard';
import { DEMO_PLAYERS, DEMO_TEAMS } from './showcase-data';
import styles from './ShowcasePage.module.css';

const BASE = '/muestra';
const NAV = [
  { to: `${BASE}/inicio`, label: 'Inicio', icon: House },
  { to: `${BASE}/plantilla`, label: 'Plantilla', icon: UsersThree, badge: 4 },
  { to: `${BASE}/alineaciones`, label: 'Alineaciones', icon: Strategy },
  { to: `${BASE}/mi-juego`, label: 'Mi juego', icon: IdentificationCard },
  { to: `${BASE}/equipo`, label: 'Equipo', icon: ShieldCheck },
];

/**
 * /muestra (solo en desarrollo): el sistema de diseño v2 con componentes reales y datos del
 * equipo demo, para decidir la dirección antes de rehacer las pantallas (docs/07, PR 2).
 */
export function ShowcasePage() {
  const [teamId, setTeamId] = useState(DEMO_TEAMS[0]!.id);
  const team = DEMO_TEAMS.find((t) => t.id === teamId)!;
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.to;
  return (
    <div className={styles.shell}>
      <TeamHeader team={team} teams={DEMO_TEAMS} onSwitch={setTeamId} />
      <div className={styles.content}>
        <Routes>
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="inicio" element={<Home />} />
          <Route path="plantilla" element={<Squad />} />
          <Route path="plantilla/:n" element={<PlayerSheet />} />
          <Route path="alineaciones" element={<Lineups />} />
          <Route path="mi-juego" element={<MyGame />} />
          <Route path="equipo" element={<Team />} />
          <Route path="pizarra" element={<BoardSamples />} />
        </Routes>
      </div>
      <BottomNav items={NAV} current={current} />
    </div>
  );
}

function Home() {
  return (
    <main className={styles.page}>
      <h1 className={styles.hello}>Hola, Kevin</h1>
      <LeadTask
        to={`${BASE}/plantilla`}
        title="Valora a 4 jugadores"
        detail="Antes de mirar su test"
      />
      <section aria-labelledby="tecnico" className={styles.group}>
        <h2 id="tecnico" className={styles.groupTitle}>
          Del cuerpo técnico
        </h2>
        <TaskRow to={`${BASE}/plantilla`} icon={ClipboardText} title="Sin test" count={3} />
        <TaskRow to={`${BASE}/plantilla`} icon={Warning} title="Re-evaluación vencida" count={1} />
        <TaskRow to={`${BASE}/alineaciones`} icon={Strategy} title="Última: Fecha 3" />
      </section>
      <section aria-labelledby="jugador" className={styles.group}>
        <h2 id="jugador" className={styles.groupTitle}>
          Como jugador
        </h2>
        <TaskRow
          to={`${BASE}/mi-juego`}
          icon={SoccerBall}
          title="Ya puedes repetir el examen de Defensa central"
        />
      </section>
    </main>
  );
}

type Filter = 'pendientes' | TokenLine;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pendientes', label: 'Por valorar' },
  { value: 'portero', label: 'Porteros' },
  { value: 'defensa', label: 'Defensas' },
  { value: 'medio', label: 'Medios' },
  { value: 'ataque', label: 'Delanteros' },
];

function Squad() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ReadonlySet<Filter>>(new Set());
  const [view, setView] = useState<'lista' | 'pizarra'>('lista');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lines = [...filters].filter((f) => f !== 'pendientes');
    return DEMO_PLAYERS.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || String(p.n) === q) &&
        (!filters.has('pendientes') || !p.assessed) &&
        (lines.length === 0 || lines.includes(lineOfPosition(p.pos))),
    );
  }, [query, filters]);
  const options = FILTERS.map((f) => ({
    ...f,
    count:
      f.value === 'pendientes'
        ? DEMO_PLAYERS.filter((p) => !p.assessed).length
        : DEMO_PLAYERS.filter((p) => lineOfPosition(p.pos) === f.value).length,
  }));

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Plantilla</h1>
        <div role="group" aria-label="Ver como" className={styles.segmented}>
          {(['lista', 'pizarra'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'lista' ? 'Lista' : 'Pizarra'}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.search}>
        <MagnifyingGlass size={20} aria-hidden="true" />
        <span className="sr-only">Buscar jugador</span>
        <input
          type="search"
          name="q"
          autoComplete="off"
          placeholder="Nombre o dorsal…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Chips
        label="Filtrar"
        options={options}
        selected={filters}
        onToggle={(v) =>
          setFilters((prev) => {
            const next = new Set(prev);
            if (next.has(v)) next.delete(v);
            else next.add(v);
            return next;
          })
        }
      />
      <p className={styles.count} aria-live="polite">
        {shown.length} de {DEMO_PLAYERS.length}
      </p>
      <ul className={styles.list}>
        {shown.map((p) => (
          <li key={p.n}>
            <Row
              to={`${BASE}/plantilla/${p.n}`}
              leading={<Token text={String(p.n)} line={lineOfPosition(p.pos)} />}
              title={p.name}
              meta={
                <>
                  {POSITIONS[p.pos].name}
                  {!p.tested && ', sin test'}
                </>
              }
              trailing={
                <>
                  {!p.assessed && (
                    <span className={styles.flag}>
                      <Warning size={16} weight="fill" aria-hidden="true" />
                      Valorar
                    </span>
                  )}
                  <span className={styles.media}>
                    {p.media ?? '–'}
                    <span className="sr-only">{p.media ? ' de media' : ' sin tarjeta'}</span>
                  </span>
                </>
              }
            />
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className={styles.empty}>Nadie con esos filtros. Quita alguno para ver más.</p>
      )}
    </main>
  );
}

function PlayerSheet() {
  const { n } = useParams();
  const p = DEMO_PLAYERS.find((x) => String(x.n) === n);
  const [tab, setTab] = useState<'resumen' | 'tarjeta' | 'conocimiento'>('resumen');
  if (!p) return <Navigate to={`${BASE}/plantilla`} replace />;
  const line = lineOfPosition(p.pos);
  return (
    <main className={styles.page}>
      <Link to={`${BASE}/plantilla`} className={styles.back}>
        Plantilla
      </Link>
      <header className={styles.hero}>
        <Token text={String(p.n)} line={line} size="xl" />
        <div className={styles.heroText}>
          <h1 className={styles.heroName}>{p.name}</h1>
          <p className={styles.heroPos}>{POSITIONS[p.pos].name}</p>
        </div>
      </header>
      <dl className={styles.stats}>
        <div>
          <dt>Media</dt>
          <dd>{p.media ?? '–'}</dd>
        </div>
        <div>
          <dt>Test</dt>
          <dd className={styles.statWord}>{p.tested ? POSITIONS[p.pos].name : 'Sin hacer'}</dd>
        </div>
        <div>
          <dt>Conocimiento</dt>
          <dd>60%</dd>
        </div>
      </dl>
      <div role="group" aria-label="Ver" className={styles.tabs}>
        {(['resumen', 'tarjeta', 'conocimiento'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'resumen' ? 'Resumen' : t === 'tarjeta' ? 'Tarjeta' : 'Conocimiento'}
          </button>
        ))}
      </div>
      <div className={styles.panel}>
        {tab === 'resumen' && (
          <ul className={styles.facts}>
            <li>
              <span>Tu valoración</span>
              <span>{p.assessed ? POSITIONS[p.pos].name : 'Sin valorar'}</span>
            </li>
            <li>
              <span>Prefiere</span>
              <span>{POSITIONS[p.pos].name}</span>
            </li>
            <li>
              <span>Podio del test</span>
              <span>{p.tested ? `${POSITIONS[p.pos].name} y 2 más` : 'Sin hacer'}</span>
            </li>
          </ul>
        )}
        {tab === 'tarjeta' && <DemoCard pos={p.pos} />}
        {tab === 'conocimiento' && (
          <ul className={styles.facts}>
            <li>
              <span>Defensa central</span>
              <span>45%, insuficiente</span>
            </li>
            <li>
              <span>Mediocentro</span>
              <span>60%, en desarrollo</span>
            </li>
          </ul>
        )}
      </div>
      <div className={styles.actions}>
        <Button>{p.assessed ? 'Volver a valorar' : 'Valorar'}</Button>
        <Button variant="secondary">Puntuar tarjeta</Button>
      </div>
    </main>
  );
}

function DemoCard({ pos }: { pos: PositionCode }) {
  const values =
    pos === 'POR'
      ? {
          PAC: 50,
          SHO: 35,
          PAS: 55,
          DRI: 40,
          DEF: 45,
          PHY: 66,
          GK_DIV: 74,
          GK_HAN: 70,
          GK_KIC: 62,
          GK_REF: 78,
          GK_SPD: 72,
          GK_POS: 70,
        }
      : { PAC: 82, SHO: 64, PAS: 62, DRI: 78, DEF: 35, PHY: 58 };
  return (
    <PlayerCard
      card={{ values, positionAverages: positionAverages(values), ratedAt: '2026-10-20T12:00:00Z' }}
      format="F11"
      headingLevel={3}
    />
  );
}

function Lineups() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Alineaciones</h1>
      <LeadTask to={`${BASE}/alineaciones`} title="Armar la del próximo partido" />
      <ul className={styles.list}>
        {[
          ['Fecha 3', '1 nov, 1-4-3-3'],
          ['Amistoso con La 14', '25 oct, 1-4-4-2'],
          ['Fecha 2', '18 oct, 1-4-3-3'],
        ].map(([name, meta]) => (
          <li key={name}>
            <Row
              to={`${BASE}/alineaciones`}
              leading={<Token text="11" size="sm" />}
              title={name}
              meta={meta}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}

function MyGame() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Mi juego</h1>
      <DemoCard pos="EXT" />
      <section aria-labelledby="posicion" className={styles.group}>
        <h2 id="posicion" className={styles.groupTitle}>
          Tu posición
        </h2>
        <ol className={styles.podium}>
          {(['EXT', 'DC', 'MP'] as const).map((pos, i) => (
            <li key={pos}>
              <Token text={String(i + 1)} line={lineOfPosition(pos)} size="sm" />
              <span>{POSITIONS[pos].name}</span>
              <span className={styles.muted}>{[86, 74, 61][i]}%</span>
            </li>
          ))}
        </ol>
        <Link to={`${BASE}/mi-juego`} className={styles.quiet}>
          Repetir el test
        </Link>
      </section>
      <section aria-labelledby="saber" className={styles.group}>
        <h2 id="saber" className={styles.groupTitle}>
          Conocimiento
        </h2>
        <TaskRow to={`${BASE}/mi-juego`} icon={SoccerBall} title="Defensa central, 45%" />
        <TaskRow to={`${BASE}/mi-juego`} icon={SoccerBall} title="Mediocentro, sin presentar" />
      </section>
    </main>
  );
}

function Team() {
  const [sheet, setSheet] = useState(false);
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Equipo</h1>
      <ul className={styles.list}>
        <li>
          <Row
            to={`${BASE}/plantilla`}
            leading={<Icon glyph={UsersThree} />}
            title="Integrantes"
            meta="16 jugadores, 2 en el cuerpo técnico"
          />
        </li>
        <li>
          <Row
            to={`${BASE}/equipo`}
            leading={<Icon glyph={UserPlus} />}
            title="Invitar jugadores"
            meta="Con un enlace"
          />
        </li>
        <li>
          <Row
            to={`${BASE}/equipo`}
            leading={<Icon glyph={ChartLineUp} />}
            title="Informe de validación"
          />
        </li>
        <li>
          <Row
            to={`${BASE}/equipo`}
            leading={<Icon glyph={Question} />}
            title="En qué se basa el test"
          />
        </li>
      </ul>
      <section aria-labelledby="cuenta" className={styles.group}>
        <h2 id="cuenta" className={styles.groupTitle}>
          Tu cuenta
        </h2>
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Cerrar sesión
        </Button>
        <Link to={`${BASE}/equipo`} className={styles.quiet}>
          Eliminar mis datos
        </Link>
      </section>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="¿Cerrar sesión?">
        <div className={styles.sheetActions}>
          <Button onClick={() => setSheet(false)}>Cerrar sesión en este celular</Button>
          <Button variant="ghost" onClick={() => setSheet(false)}>
            En todos tus dispositivos
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

function Icon({ glyph: Glyph }: { glyph: typeof House }) {
  return (
    <span className={styles.rowIcon} aria-hidden="true">
      <Glyph size={22} />
    </span>
  );
}

/** Preguntas tipo pizarra del examen (Fase 8), para ver cómo se ven antes de escribir bancos. */
const BOARD_SAMPLES = [
  {
    text: 'El 9 rival recibe de espaldas en la puerta del área. ¿Dónde te paras?',
    board: {
      view: 'own-half' as const,
      pieces: [
        { side: 'own' as const, x: 50, y: 124, label: '4', you: true },
        { side: 'own' as const, x: 30, y: 126, label: '2' },
        { side: 'own' as const, x: 12, y: 118, label: '3' },
        { side: 'own' as const, x: 88, y: 118, label: '6' },
        { side: 'own' as const, x: 50, y: 94, label: '5' },
        { side: 'rival' as const, x: 52, y: 108, label: '9' },
        { side: 'rival' as const, x: 36, y: 86, label: '8' },
        { side: 'rival' as const, x: 78, y: 92, label: '7' },
      ],
      ball: { x: 37, y: 89 },
      arrows: [{ kind: 'pass' as const, from: { x: 38, y: 89 }, to: { x: 51, y: 105 } }],
    },
    options: [
      { label: 'Pegado a su espalda, sin dejarlo girar', spot: { x: 52, y: 118 } },
      { label: 'Adelante, para anticipar el pase', spot: { x: 52, y: 98 } },
      { label: 'A un costado, cerrando el giro hacia afuera', spot: { x: 70, y: 106 } },
      { label: 'Atrás, cerca del arco, esperando', spot: { x: 50, y: 138 } },
    ],
  },
  {
    text: 'Recuperas en el medio y el 7 ya arrancó. ¿A quién se la das?',
    board: {
      view: 'rival-half' as const,
      pieces: [
        { side: 'own' as const, x: 50, y: 62, label: '8', you: true },
        { side: 'own' as const, x: 80, y: 42, label: '7' },
        { side: 'own' as const, x: 50, y: 28, label: '9' },
        { side: 'own' as const, x: 32, y: 46, label: '10' },
        { side: 'own' as const, x: 14, y: 66, label: '3' },
        { side: 'rival' as const, x: 52, y: 22 },
        { side: 'rival' as const, x: 38, y: 40 },
        { side: 'rival' as const, x: 64, y: 30 },
        { side: 'rival' as const, x: 72, y: 50 },
      ],
      ball: { x: 53, y: 64 },
      arrows: [{ kind: 'run' as const, from: { x: 80, y: 42 }, to: { x: 86, y: 18 } }],
    },
    options: [
      { label: 'Al espacio, a la carrera del 7', spot: { x: 86, y: 20 } },
      { label: 'Al pie del 9, de espaldas', spot: { x: 48, y: 34 } },
      { label: 'Al 10, entre líneas', spot: { x: 26, y: 48 } },
      { label: 'Atrás, al lateral', spot: { x: 14, y: 70 } },
    ],
  },
];

function BoardSamples() {
  const [chosen, setChosen] = useState<Record<number, string>>({});
  return (
    <>
      {BOARD_SAMPLES.map((sample, n) => {
        const options = sample.options.map((o, i) => ({
          ...o,
          id: `${n}-${i}`,
          letter: 'ABCD'[i]!,
        }));
        return (
          <section key={n} className={styles.group} aria-label={`Pregunta de muestra ${n + 1}`}>
            <h2 className={styles.groupTitle}>{sample.text}</h2>
            <ExamBoard
              board={sample.board}
              options={options}
              chosen={chosen[n] ?? null}
              disabled={false}
              onChoose={(id) => setChosen({ ...chosen, [n]: id })}
            />
            {options.map((o) => (
              <p key={o.id} className={styles.muted}>
                {o.letter}. {o.label}
              </p>
            ))}
          </section>
        );
      })}
    </>
  );
}
