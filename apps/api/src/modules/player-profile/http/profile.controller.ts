import { Body, Controller, Delete, Patch, Put } from '@nestjs/common';
import {
  PreferredPositionsRequestSchema,
  type ProfileResponse,
  UpdateProfileRequestSchema,
} from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import { photoBody } from '../../../shared/photos/photo-body.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { PlayerProfiles } from '../application/profile.use-cases.js';

@Controller('me')
export class ProfileController {
  constructor(private readonly profiles: PlayerProfiles) {}

  @Patch('profile')
  async update(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<ProfileResponse> {
    const patch = parseInput(UpdateProfileRequestSchema, body);
    return { profile: await this.profiles.update(session.user, patch) };
  }

  @Put('preferred-positions')
  async preferred(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<ProfileResponse> {
    const request = parseInput(PreferredPositionsRequestSchema, body);
    return { profile: await this.profiles.setPreferredPositions(session.user, request) };
  }

  /** La foto llega como bytes (`Content-Type: image/webp` o `image/jpeg`), ya recortada. */
  @Put('photo')
  async photo(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<ProfileResponse> {
    return { profile: await this.profiles.setPhoto(session.user, photoBody(body)) };
  }

  @Delete('photo')
  async removePhoto(@CurrentSession() session: AuthSession): Promise<ProfileResponse> {
    return { profile: await this.profiles.removePhoto(session.user) };
  }
}
