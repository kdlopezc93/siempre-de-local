import { Brain } from '@phosphor-icons/react/dist/csr/Brain';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { SoccerBall } from '@phosphor-icons/react/dist/csr/SoccerBall';
import type { Icon } from '@phosphor-icons/react';
import { Link } from 'react-router';

import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import styles from './MyGamePage.module.css';

/**
 * /equipos/:teamId/mi-juego — lo tuyo como jugador en un solo lugar. Por ahora reúne las
 * pantallas que ya existen; el PR 7 de la Fase 6 las junta en una sola (07 §4.3).
 */
export function MyGamePage({ teamId }: { teamId: string }) {
  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>Mi juego</h1>
      <ul className={styles.list}>
        <Item to={`/equipos/${teamId}/tarjeta`} icon={IdentificationCard} title="Mi tarjeta" />
        <Item to="/historial" icon={SoccerBall} title="Mi posición" meta="Tus tests" />
        <Item to="/conocimiento" icon={Brain} title="Conocimiento" meta="Exámenes por posición" />
        <Item to="/perfil" icon={NotePencil} title="Editar mi perfil" />
      </ul>
      <Link to={`/equipos/${teamId}/test`} className={styles.quiet}>
        Hacer el test de posición
      </Link>
    </Screen>
  );
}

function Item({
  to,
  icon: Glyph,
  title,
  meta,
}: {
  to: string;
  icon: Icon;
  title: string;
  meta?: string;
}) {
  return (
    <li>
      <Row
        to={to}
        leading={
          <span className={styles.icon} aria-hidden="true">
            <Glyph size={22} />
          </span>
        }
        title={title}
        meta={meta}
      />
    </li>
  );
}
