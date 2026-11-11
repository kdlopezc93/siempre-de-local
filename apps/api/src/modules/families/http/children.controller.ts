import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ChildPaymentRequestSchema,
  MatchReplyRequestSchema,
  type MatchListResponse,
  type MatchResponse,
  type MyChargesResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import { Charges } from '../../charges/application/charges.use-cases.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { Matches } from '../../matches/application/matches.use-cases.js';
import { ChildActors } from '../application/child-actor.js';

const Id = z.uuid();

/**
 * Lo que el acudiente hace por su hijo (escuelas, PR 3, 2026-11-10): ver sus partidos y responder
 * la convocatoria, y ver y reportar sus cobros. Rutas acotadas a propósito: el acudiente no es
 * del equipo. `ChildActors` comprueba que el niño es suyo; los casos de uso deciden el resto con
 * el actor del niño (un jugador del grupo).
 */
@Controller('me/children/:minorId/teams/:teamId')
export class ChildrenController {
  constructor(
    private readonly children: ChildActors,
    private readonly matches: Matches,
    private readonly charges: Charges,
  ) {}

  private actor(session: AuthSession, minorId: string) {
    return this.children.actorFor(session.user.id, parseInput(Id, minorId));
  }

  @Get('matches')
  async listMatches(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Param('teamId') teamId: string,
  ): Promise<MatchListResponse> {
    const actor = await this.actor(session, minorId);
    return { items: await this.matches.list(actor, parseInput(Id, teamId)) };
  }

  @Get('matches/:matchId')
  async getMatch(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchResponse> {
    const actor = await this.actor(session, minorId);
    return this.matches.get(actor, parseInput(Id, teamId), parseInput(Id, matchId));
  }

  @Put('matches/:matchId/reply')
  async reply(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    const actor = await this.actor(session, minorId);
    return this.matches.reply(
      actor,
      parseInput(Id, teamId),
      parseInput(Id, matchId),
      parseInput(MatchReplyRequestSchema, body).reply,
    );
  }

  @Get('charges')
  async myCharges(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Param('teamId') teamId: string,
  ): Promise<MyChargesResponse> {
    const actor = await this.actor(session, minorId);
    return this.charges.mine(actor, parseInput(Id, teamId));
  }

  @Post('charges/:chargeId/payments')
  async report(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: unknown,
  ): Promise<MyChargesResponse> {
    const actor = await this.actor(session, minorId);
    return this.charges.reportPayment(
      actor,
      parseInput(Id, teamId),
      parseInput(Id, chargeId),
      parseInput(ChildPaymentRequestSchema, body),
    );
  }
}
