import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { HealthResponse } from '@sdl/contracts';
import { sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  @Get()
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponse> {
    const database = await this.pingDatabase();
    if (database === 'down') void reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: database === 'up' ? 'ok' : 'degraded', checks: { database } };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      await this.connection.db.execute(sql`select 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
