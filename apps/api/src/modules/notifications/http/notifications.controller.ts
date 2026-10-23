import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import {
  type PushPublicKeyResponse,
  PushSubscriptionRequestSchema,
  PushUnsubscribeRequestSchema,
} from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { Notifications } from '../application/notifications.use-cases.js';

/** Activar o apagar los avisos de este celular (Fase 7, D16). */
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: Notifications) {}

  @Get('push/public-key')
  publicKey(): PushPublicKeyResponse {
    return { publicKey: this.notifications.publicKey() };
  }

  @Post('me/push-subscriptions')
  @HttpCode(204)
  async subscribe(@CurrentSession() session: AuthSession, @Body() body: unknown): Promise<void> {
    const { endpoint, keys } = parseInput(PushSubscriptionRequestSchema, body);
    await this.notifications.subscribe(session.user.id, { endpoint, ...keys });
  }

  @Delete('me/push-subscriptions')
  @HttpCode(204)
  async unsubscribe(@CurrentSession() session: AuthSession, @Body() body: unknown): Promise<void> {
    const { endpoint } = parseInput(PushUnsubscribeRequestSchema, body);
    await this.notifications.unsubscribe(session.user.id, endpoint);
  }
}
