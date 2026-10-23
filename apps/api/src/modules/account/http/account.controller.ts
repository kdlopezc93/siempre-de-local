import { Body, Controller, Delete, Get, Header, HttpCode } from '@nestjs/common';
import { DeleteAccountRequestSchema, type MyDataExport } from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { MyData } from '../application/account.use-cases.js';

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
