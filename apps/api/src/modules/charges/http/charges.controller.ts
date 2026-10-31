import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  type ChargeListResponse,
  type ChargeResponse,
  CreateChargeRequestSchema,
  type MyChargesResponse,
  MyPaymentRequestSchema,
  PaymentRequestSchema,
  ShareRequestSchema,
  SponsorRequestSchema,
  UpdateChargeRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { Charges } from '../application/charges.use-cases.js';

/** Cobros del equipo (`06` Cobros): cuerpo técnico y tesorero. */
@Controller('teams/:teamId/charges')
export class ChargesController {
  constructor(private readonly charges: Charges) {}

  @Get()
  @Can('team.charges.read', { teamParam: 'teamId' })
  list(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<ChargeListResponse> {
    return this.charges.list(actor, teamId);
  }

  @Post()
  @Can('team.charges.write', { teamParam: 'teamId' })
  create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<ChargeResponse> {
    return this.charges.create(actor, teamId, parseInput(CreateChargeRequestSchema, body));
  }

  @Get(':chargeId')
  @Can('team.charges.read', { teamParam: 'teamId' })
  get(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
  ): Promise<ChargeResponse> {
    return this.charges.get(actor, teamId, parseInput(z.uuid(), chargeId));
  }

  @Patch(':chargeId')
  @Can('team.charges.write', { teamParam: 'teamId' })
  update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: unknown,
  ): Promise<ChargeResponse> {
    return this.charges.update(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(UpdateChargeRequestSchema, body),
    );
  }

  /** Ajustar lo que debe alguien, o sumarlo al cobro. */
  @Put(':chargeId/shares/:userId')
  @Can('team.charges.write', { teamParam: 'teamId' })
  setShare(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<ChargeResponse> {
    return this.charges.setShare(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(z.uuid(), userId),
      parseInput(ShareRequestSchema, body),
    );
  }

  /** Que la parte de alguien la asuma otro jugador o el equipo (o devolvérsela). */
  @Put(':chargeId/shares/:userId/sponsor')
  @Can('team.charges.write', { teamParam: 'teamId' })
  sponsor(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<ChargeResponse> {
    return this.charges.sponsor(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(z.uuid(), userId),
      parseInput(SponsorRequestSchema, body),
    );
  }

  /** Un pago o abono que registra el tesorero: queda confirmado. */
  @Post(':chargeId/payments')
  @Can('team.charges.write', { teamParam: 'teamId' })
  registerPayment(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: unknown,
  ): Promise<ChargeResponse> {
    return this.charges.registerPayment(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(PaymentRequestSchema, body),
    );
  }

  @Post(':chargeId/payments/:paymentId/confirm')
  @HttpCode(200)
  @Can('team.charges.write', { teamParam: 'teamId' })
  confirm(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<ChargeResponse> {
    return this.charges.reviewPayment(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(z.uuid(), paymentId),
      'confirmed',
    );
  }

  @Post(':chargeId/payments/:paymentId/reject')
  @HttpCode(200)
  @Can('team.charges.write', { teamParam: 'teamId' })
  reject(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<ChargeResponse> {
    return this.charges.reviewPayment(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(z.uuid(), paymentId),
      'rejected',
    );
  }
}

/** Lo que debe y pagó cada uno: solo lo suyo. */
@Controller('teams/:teamId/me/charges')
export class MyChargesController {
  constructor(private readonly charges: Charges) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  mine(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<MyChargesResponse> {
    return this.charges.mine(actor, teamId);
  }

  /** "Ya pagué" (o un abono): queda reportado hasta que lo confirmen. */
  @Post(':chargeId/payments')
  @Can('team.read', { teamParam: 'teamId' })
  report(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: unknown,
  ): Promise<MyChargesResponse> {
    return this.charges.reportPayment(
      actor,
      teamId,
      parseInput(z.uuid(), chargeId),
      parseInput(MyPaymentRequestSchema, body),
    );
  }
}
