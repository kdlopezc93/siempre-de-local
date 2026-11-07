import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateMatchRequestSchema,
  CreateTournamentRequestSchema,
  MatchAttendanceRequestSchema,
  type MatchListResponse,
  MatchRatingRequestSchema,
  type MatchRatingsResponse,
  MatchReplyRequestSchema,
  type MatchResponse,
  MatchResultRequestSchema,
  type PlayerMatchRatingsResponse,
  type RemindMatchResponse,
  type TournamentListResponse,
  type TournamentResponse,
  UpdateMatchRequestSchema,
  type TeamScorersResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { Public } from '../../../shared/authz/public.decorator.js';
import { CronGuard } from '../../../shared/http/cron.guard.js';
import { parseInput } from '../../../shared/http/validation.js';
import { Matches } from '../application/matches.use-cases.js';

/** Partidos del equipo (Fase 7). */
@Controller('teams/:teamId/matches')
export class MatchesController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<MatchListResponse> {
    return { items: await this.matches.list(actor, teamId) };
  }

  @Post()
  @Can('team.matches.write', { teamParam: 'teamId' })
  create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.create(actor, teamId, parseInput(CreateMatchRequestSchema, body));
  }

  @Get(':matchId')
  @Can('team.read', { teamParam: 'teamId' })
  get(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchResponse> {
    return this.matches.get(actor, teamId, parseInput(z.uuid(), matchId));
  }

  @Patch(':matchId')
  @Can('team.matches.write', { teamParam: 'teamId' })
  update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.update(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(UpdateMatchRequestSchema, body),
    );
  }

  @Put(':matchId/reply')
  @Can('team.read', { teamParam: 'teamId' })
  reply(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.reply(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(MatchReplyRequestSchema, body).reply,
    );
  }

  /** "Recordarles ahora" (2026-11-06): a los que no han respondido, una vez cada 2 horas. */
  @Post(':matchId/reminders')
  @HttpCode(200)
  @Can('team.matches.write', { teamParam: 'teamId' })
  remind(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<RemindMatchResponse> {
    return this.matches.remind(actor, teamId, parseInput(z.uuid(), matchId));
  }

  /** Después del partido (D18): resultado y figura. */
  @Put(':matchId/result')
  @Can('team.matches.write', { teamParam: 'teamId' })
  recordResult(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.recordResult(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(MatchResultRequestSchema, body),
    );
  }

  /** "¿Quién vino?" (2026-10-30): la lista del partido, desde la hora. */
  @Put(':matchId/attendance')
  @Can('team.attendance.write', { teamParam: 'teamId' })
  takeAttendance(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.takeAttendance(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(MatchAttendanceRequestSchema, body),
    );
  }

  @Get(':matchId/ratings')
  @Can('team.results.read', { teamParam: 'teamId' })
  ratings(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchRatingsResponse> {
    return this.matches.ratings(actor, teamId, parseInput(z.uuid(), matchId));
  }

  @Put(':matchId/ratings/:playerId')
  @Can('team.ratings.write', { teamParam: 'teamId' })
  rate(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<MatchRatingsResponse> {
    return this.matches.rate(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(z.uuid(), playerId),
      parseInput(MatchRatingRequestSchema, body),
    );
  }

  @Delete(':matchId/ratings/:playerId')
  @Can('team.ratings.write', { teamParam: 'teamId' })
  unrate(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
  ): Promise<MatchRatingsResponse> {
    return this.matches.unrate(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(z.uuid(), playerId),
    );
  }
}

/** Cómo le fue a un jugador partido a partido (ficha del jugador, cuerpo técnico). */
@Controller('teams/:teamId/players/:playerId/match-ratings')
export class PlayerMatchRatingsController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ): Promise<PlayerMatchRatingsResponse> {
    return this.matches.playerRatings(actor, teamId, parseInput(z.uuid(), playerId));
  }
}

/** Goleadores, asistencias y tarjetas del equipo (2026-11-06): todo el equipo. */
@Controller('teams/:teamId/scorers')
export class ScorersController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<TeamScorersResponse> {
    return this.matches.scorers(actor, teamId);
  }
}

/** Los torneos del equipo (2026-10-28): los partidos de campeonato son de uno. */
@Controller('teams/:teamId/tournaments')
export class TournamentsController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<TournamentListResponse> {
    return { items: await this.matches.tournaments(actor, teamId) };
  }

  @Post()
  @Can('team.matches.write', { teamParam: 'teamId' })
  async create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<TournamentResponse> {
    const { name } = parseInput(CreateTournamentRequestSchema, body);
    return { tournament: await this.matches.createTournament(actor, teamId, name) };
  }
}

/** La tarea del recordatorio (GitHub Actions, cada media hora): sin sesión, con `CRON_SECRET`. */
@Controller('cron')
@Public()
@UseGuards(CronGuard)
export class MatchesCronController {
  constructor(private readonly matches: Matches) {}

  /** Recordar la convocatoria a los que no han respondido (2026-11-06). */
  @Post('call-up-reminders')
  @HttpCode(200)
  remindDue(): Promise<{ matches: number; reminded: number }> {
    return this.matches.remindDue();
  }
}
