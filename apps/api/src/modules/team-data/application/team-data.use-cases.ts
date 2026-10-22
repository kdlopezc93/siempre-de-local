import { Inject, Injectable } from '@nestjs/common';
import {
  ELIGIBLE_POSITIONS,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  POSITIONS,
  positionAverages,
  RATING_ATTRIBUTES,
  type PositionCode,
} from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  RATINGS_REPOSITORY,
  type RatingsRepository,
} from '../../ratings/application/ports/ratings.repository.js';
import { GetSquad } from '../../squad/application/get-squad.use-case.js';
import {
  TEAMS_REPOSITORY,
  type TeamRecord,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const names = (codes: readonly PositionCode[]) => codes.map((c) => POSITIONS[c].name).join(' | ');

async function authorizedTeam(
  teams: TeamsRepository,
  actor: Actor,
  teamId: string,
): Promise<TeamRecord> {
  const team = await teams.findById(teamId);
  if (!team) throw new NotFoundError('Equipo no encontrado');
  // Exportar: coach y admin del club (04 §2.2), no el asistente.
  if (!can(actor, 'team.data.transfer', { teamId: team.id, clubId: team.club.id })) {
    throw new ForbiddenError(
      'Solo el entrenador o el admin del club descargan los datos del equipo.',
    );
  }
  return team;
}

/**
 * La plantilla en CSV, una fila por jugador. Respeta la regla a ciegas: lo que quien exporta
 * no ve en la plantilla tampoco sale en el archivo. Sin notas (minimización). Auditada.
 */
@Injectable()
export class ExportTeam {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly squad: GetSquad,
  ) {}

  async execute(actor: Actor, teamId: string, now = new Date()) {
    const team = await authorizedTeam(this.teams, actor, teamId);
    const [{ players }, cards] = await Promise.all([
      this.squad.execute(actor, teamId),
      this.ratings.latestByTeam(teamId),
    ]);
    const positions = ELIGIBLE_POSITIONS[team.format];
    const attributes = [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES];

    const header = [
      'Nombre',
      'Dorsal',
      'Preferidas',
      'Test_fecha',
      'Test_podio',
      'Cuerpo_tecnico',
      'Tambien',
      'Confianza',
      'Valorado_el',
      'Tarjeta_fecha',
      ...attributes.map((code) => RATING_ATTRIBUTES[code].short),
      ...positions.map((pos) => `Media_${pos}`),
    ];
    const rows = players.map((p) => {
      const card = cards.get(p.userId);
      const averages = card ? positionAverages(card.values) : {};
      const a = p.latestAssessment;
      return [
        p.displayName,
        p.jerseyNumber?.toString() ?? '',
        names(p.preferredPositions),
        p.test.status === 'visible' ? p.test.submittedAt.slice(0, 10) : '',
        p.test.status === 'visible'
          ? names(p.test.podium)
          : p.test.status === 'hidden'
            ? 'Oculto hasta que lo valores'
            : '',
        a ? POSITIONS[a.primaryPosition].name : '',
        a ? names(a.secondaryPositions) : '',
        a ? String(a.confidence) : '',
        a ? a.createdAt.slice(0, 10) : '',
        card ? card.ratedAt.toISOString().slice(0, 10) : '',
        ...attributes.map((code) => card?.values[code]?.toString() ?? ''),
        ...positions.map((pos) => averages[pos]?.toString() ?? ''),
      ];
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.exported',
      entity: 'team',
      entityId: team.id,
      teamId: team.id,
      meta: { format: 'csv', players: rows.length },
    });
    const day = now.toISOString().slice(0, 10);
    return { filename: `plantilla-${slug(team.name)}-${day}.csv`, rows: [header, ...rows] };
  }
}

function slug(name: string) {
  return (
    fold(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'equipo'
  );
}
