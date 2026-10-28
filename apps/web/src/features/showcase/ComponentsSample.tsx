import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Bell } from '@phosphor-icons/react/dist/csr/Bell';
import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { Timer } from '@phosphor-icons/react/dist/csr/Timer';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { useState } from 'react';

import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Chips } from '../../shared/ui/Chips';
import { IconButton } from '../../shared/ui/IconButton';
import { PageTitle } from '../../shared/ui/PageTitle';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { RingProgress } from '../../shared/ui/RingProgress';
import { Row } from '../../shared/ui/Row';
import { SearchField } from '../../shared/ui/SearchField';
import { SectionHead } from '../../shared/ui/SectionHead';
import { SectionTabs } from '../../shared/ui/SectionTabs';
import { Segmented } from '../../shared/ui/Segmented';
import { StatGrid, StatTile } from '../../shared/ui/StatTile';
import styles from './ComponentsSample.module.css';

const PLAYERS = [
  { name: 'Sofía Méndez', meta: 'Mediocentro, 92 % asist.', status: ['success', 'Al día'] },
  { name: 'Tomás Ruiz', meta: 'Lateral, 78 % asist.', status: ['warning', 'Pendiente'] },
  { name: 'Valentina Ríos', meta: 'Extremo, 97 % asist.', status: ['success', 'Al día'] },
  { name: 'Mateo Castro', meta: 'Portero, 85 % asist.', status: ['danger', 'Vencido'] },
] as const;

/**
 * /muestra/componentes (solo en desarrollo): los componentes del sistema "Escuelas Deportivas"
 * portados a shared/ui, armados como el inicio del atleta del kit original, para compararlos.
 */
export function ComponentsSample() {
  const [chips, setChips] = useState<ReadonlySet<string>>(new Set(['todos']));
  const [period, setPeriod] = useState<'semana' | 'mes'>('semana');
  const [tab, setTab] = useState<'todos' | 'defensa' | 'medio' | 'ataque'>('todos');
  const [query, setQuery] = useState('');

  return (
    <div className={styles.page}>
      <PageTitle
        eyebrow="Hola, Sofía"
        title="Tu semana"
        actions={<IconButton label="Avisos" icon={<Bell size={20} />} badge={2} />}
      />

      <section className={styles.hero} aria-label="Entrenamiento de hoy">
        <div className={styles.heroBadges}>
          <Badge tone="white">Hoy, 17:00</Badge>
          <Badge tone="accent">Racha 7 días</Badge>
        </div>
        <p className={styles.overline}>Entrenamiento de hoy</p>
        <h2 className={styles.heroTitle}>Técnica de pase y control</h2>
        <p className={styles.heroMeta}>
          <span>
            <MapPin size={16} aria-hidden="true" /> Cancha 2
          </span>
          <span>
            <Timer size={16} aria-hidden="true" /> 90 min
          </span>
          <span>
            <User size={16} aria-hidden="true" /> Andrés Lara
          </span>
        </p>
        <Button variant="accent">
          Confirmar asistencia <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </section>

      <div className={styles.card}>
        <RingProgress value={75} size={110} stroke={12} tone="ink" label="75 %" sublabel="meta" />
        <div>
          <p className={styles.caption}>Horas entrenadas</p>
          <p className={styles.figure}>
            6,75 <span className={styles.figureOf}>/ 9 h</span>
          </p>
          <p className={styles.caption}>Te faltan 2 h 15 min para tu meta semanal.</p>
        </div>
      </div>

      <section aria-labelledby="temporada">
        <SectionHead id="temporada" title="Esta temporada" link={{ to: '.', label: 'Ver todo' }} />
        <div className={styles.gap}>
          <StatGrid>
            <StatTile label="Partidos" value={12} />
            <StatTile label="Goles" value={4} delta="+2" />
            <StatTile label="Asist." value={6} delta="+1" />
          </StatGrid>
        </div>
      </section>

      <section aria-labelledby="tonos">
        <SectionHead id="tonos" title="Tarjetas de color" />
        <div className={styles.gap}>
          <StatGrid columns={2}>
            <StatTile label="Asistencia" value="87 %" tone="ink" align="start" />
            <StatTile label="Pagos pendientes" value={14} tone="coral" align="start" />
            <StatTile label="Minutos" value={405} tone="volt" align="start" delta="+12 %" />
            <StatTile label="Activos" value={186} tone="brand" align="start" />
          </StatGrid>
        </div>
      </section>

      <section aria-labelledby="controles" className={styles.stack}>
        <SectionHead id="controles" title="Controles" />
        <Segmented
          label="Periodo"
          options={[
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mes' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <SearchField
          label="Buscar"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={setQuery}
        />
        <Chips
          label="Filtrar"
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'f8', label: 'Fútbol 8' },
            { value: 'f11', label: 'Fútbol 11' },
            { value: 'lesionados', label: 'Lesionados', count: 2 },
          ]}
          selected={chips}
          onToggle={(v) => setChips(new Set([v]))}
        />
        <SectionTabs
          label="Línea"
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'defensa', label: 'Defensa' },
            { value: 'medio', label: 'Medio' },
            { value: 'ataque', label: 'Ataque' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </section>

      <section aria-labelledby="jugadores">
        <SectionHead id="jugadores" title="Jugadores" />
        <ul className={styles.list}>
          {PLAYERS.map((p) => (
            <li key={p.name}>
              <Row
                to="."
                leading={<Avatar name={p.name} />}
                title={p.name}
                meta={p.meta}
                trailing={<Badge tone={p.status[0]}>{p.status[1]}</Badge>}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="avance" className={styles.skills}>
        <h2 id="avance" className={styles.cardTitle}>
          Habilidades
        </h2>
        <ProgressBar label="Precisión de pases" value={88} valueLabel="88 %" />
        <ProgressBar label="Definición" value={64} valueLabel="64 %" tone="accent" />
        <ProgressBar label="Resistencia" value={71} valueLabel="71 %" tone="ink" />
      </section>

      <section aria-labelledby="insignias" className={styles.stack}>
        <SectionHead id="insignias" title="Insignias y botones" />
        <div className={styles.wrap}>
          <Badge tone="live" dot>
            En vivo
          </Badge>
          <Badge tone="success">Al día</Badge>
          <Badge tone="warning">Pendiente</Badge>
          <Badge tone="danger">Vencido</Badge>
          <Badge tone="brand">Volante, 8</Badge>
          <Badge tone="neutral">14 atletas</Badge>
          <Badge tone="inverse">+12 % vs. anterior</Badge>
        </div>
        <div className={styles.wrap}>
          <IconButton label="Invitar" icon={<UserPlus size={20} />} variant="brand" />
          <IconButton label="Avisos" icon={<Bell size={20} />} variant="sunken" />
          <IconButton label="Avisos" icon={<Bell size={20} />} variant="dark" badge={3} />
          <Avatar name="Ana Pérez" size={48} />
          <Avatar name="Beto Gómez" size={48} shape="circle" />
          <Avatar name="Ciro Díaz" size={48} ring="var(--sdl-accent)" />
        </div>
      </section>
    </div>
  );
}
