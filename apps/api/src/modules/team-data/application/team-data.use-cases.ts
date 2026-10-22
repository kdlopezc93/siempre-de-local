import { Inject, Injectable } from '@nestjs/common';
import type { LegacyImportResponse, LegacyResult } from '@sdl/contracts';
import {
  ELIGIBLE_POSITIONS,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  parseLegacyCsv,
  POSITIONS,
  positionAverages,
  RATING_ATTRIBUTES,
  type PositionCode,
} from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  RATINGS_REPOSITORY,
  type RatingsRepository,
} from '../../ratings/application/ports/ratings.repository.js';
import { GetSquad } from '../../squad/application/get-squad.use-case.js';
import {
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from '../../squad/application/ports/squad.ports.js';
import {
  TEAMS_REPOSITORY,
  type TeamRecord,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  LEGACY_RESULTS_REPOSITORY,
  type LegacyResultsRepository,
} from './ports/legacy-results.repository.js';

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
  // Importar y exportar: coach y admin del club (04 §2.2), no el asistente.
  if (!can(actor, 'team.data.transfer', { teamId: team.id, clubId: team.club.id })) {
    throw new ForbiddenError('Solo el entrenador o el admin del club mueven los datos del equipo.');
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

/** Resultados del prototipo (02 §12). */
@Injectable()
export class LegacyResults {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(LEGACY_RESULTS_REPOSITORY) private readonly results: LegacyResultsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async import(actor: Actor, teamId: string, csv: string): Promise<LegacyImportResponse> {
    const team = await authorizedTeam(this.teams, actor, teamId);
    const { rows, rejected } = parseLegacyCsv(csv);
    const byName = await this.playersByName(teamId);
    const linkedRows = rows.map((row) => ({
      ...row,
      // Sin formato en el CSV: el del equipo.
      format: row.format ?? team.format,
      playerUserId: byName.get(fold(row.playerName)) ?? null,
    }));
    const imported = await this.results.insertMany(teamId, actor.userId, linkedRows);
    const summary = {
      imported,
      duplicates: rows.length - imported,
      // Cuenta sobre las leídas: las repetidas ya estaban ligadas igual.
      linked: linkedRows.filter((r) => r.playerUserId).length,
      rejected,
    };
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.legacy_imported',
      entity: 'team',
      entityId: team.id,
      teamId: team.id,
      meta: { ...summary, rejected: rejected.length },
    });
    return summary;
  }

  async list(actor: Actor, teamId: string): Promise<LegacyResult[]> {
    await authorizedTeam(this.teams, actor, teamId);
    const [stored, players] = await Promise.all([
      this.results.listByTeam(teamId),
      this.players.activePlayers(teamId),
    ]);
    const profiles = await this.profiles.profilesOf(
      players.map((p) => ({ id: p.userId, name: p.name })),
    );
    return stored.map(({ playerUserId, importedAt, ...rest }) => {
      const profile = playerUserId ? profiles.get(playerUserId) : undefined;
      return {
        ...rest,
        // Ligado a alguien que ya no está en el equipo: se muestra sin ligar.
        player: profile ? { userId: playerUserId!, displayName: profile.displayName } : null,
        importedAt: importedAt.toISOString(),
      };
    });
  }

  /** Nombre (nombre visible o de Google, sin tildes ni mayúsculas) → jugador, si es único. */
  private async playersByName(teamId: string): Promise<Map<string, string>> {
    const players = await this.players.activePlayers(teamId);
    const profiles = await this.profiles.profilesOf(
      players.map((p) => ({ id: p.userId, name: p.name })),
    );
    const owners = new Map<string, Set<string>>();
    for (const p of players) {
      for (const n of [p.name, profiles.get(p.userId)?.displayName ?? '']) {
        if (!n.trim()) continue;
        const key = fold(n);
        owners.set(key, (owners.get(key) ?? new Set()).add(p.userId));
      }
    }
    return new Map(
      [...owners].filter(([, ids]) => ids.size === 1).map(([key, ids]) => [key, [...ids][0]!]),
    );
  }
}
