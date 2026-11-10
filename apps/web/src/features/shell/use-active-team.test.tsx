import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from '../../test/me-two-teams';
import { useActiveTeam } from './use-active-team';

/** El selector del encabezado: un botón que elige el otro equipo. */
function Header() {
  const { active, choose } = useActiveTeam(ME_TWO_TEAMS);
  return (
    <>
      <p>encabezado: {active?.team.id}</p>
      <button type="button" onClick={() => choose(TEAM_B)}>
        Cambiar
      </button>
    </>
  );
}

function Home() {
  const { active } = useActiveTeam(ME_TWO_TEAMS);
  return <p>inicio: {active?.team.id}</p>;
}

describe('el equipo activo es uno solo (2026-11-10)', () => {
  beforeEach(() => localStorage.clear());

  it('al cambiarlo en el encabezado, el inicio también cambia', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`inicio: ${TEAM_A}`)).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Cambiar' }).click());
    expect(screen.getByText(`encabezado: ${TEAM_B}`)).toBeInTheDocument();
    expect(screen.getByText(`inicio: ${TEAM_B}`)).toBeInTheDocument();
  });
});
