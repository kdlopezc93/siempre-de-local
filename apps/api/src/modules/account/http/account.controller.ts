import { Body, Controller, Delete, Get, Header, HttpCode, Param } from '@nestjs/common';
import { z } from 'zod';
import { DeleteAccountRequestSchema, type MyDataExport } from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { MinorData, MyData } from '../application/account.use-cases.js';

/** Tus datos: descargarlos y eliminar tu cuenta (07 §4.5). */
@Controller('me')
export class AccountController {
  constructor(private readonly myData: MyData) {}

  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="mis-datos-siempre-de-local.json"')
  @Header('Cache-Control', 'no-store')
  export(@CurrentSession() session: AuthSession): Promise<MyDataExport> {
    return this.myData.export(session.user);
  }

  @Delete()
  @HttpCode(204)
  async delete(@CurrentSession() session: AuthSession, @Body() body: unknown): Promise<void> {
    parseInput(DeleteAccountRequestSchema, body);
    await this.myData.delete(session.user);
  }
}

/** Los datos de un hijo: descargarlos y borrarlos, desde la cuenta del acudiente (2026-11-10). */
@Controller('me/children')
export class MinorDataController {
  constructor(private readonly minorData: MinorData) {}

  @Get(':minorId/export')
  @Header('Content-Disposition', 'attachment; filename="datos-de-mi-hijo-siempre-de-local.json"')
  @Header('Cache-Control', 'no-store')
  export(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
  ): Promise<MyDataExport> {
    return this.minorData.export(session.user.id, parseInput(z.uuid(), minorId));
  }

  /** Retirar la autorización: borra al niño y todo lo suyo en el momento. */
  @Delete(':minorId')
  @HttpCode(204)
  async delete(
    @CurrentSession() session: AuthSession,
    @Param('minorId') minorId: string,
    @Body() body: unknown,
  ): Promise<void> {
    parseInput(DeleteAccountRequestSchema, body);
    await this.minorData.delete(session.user.id, parseInput(z.uuid(), minorId));
  }
}
