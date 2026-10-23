import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { parseInput } from '../../../shared/http/validation.js';
import { PlayerProfiles } from '../application/profile.use-cases.js';

/** GET /players/:userId/photo — la foto de un jugador, solo para su equipo (ADR-09). */
@Controller('players')
export class PlayerPhotoController {
  constructor(private readonly profiles: PlayerProfiles) {}

  @Get(':userId/photo')
  // La URL lleva la versión (?v=): una foto nueva es otra URL. Privada: va con sesión.
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async photo(@CurrentSession() session: AuthSession, @Param('userId') userId: string) {
    const photo = await this.profiles.readPhoto(session.user.id, parseInput(z.uuid(), userId));
    return new StreamableFile(photo.bytes, { type: photo.contentType });
  }
}
