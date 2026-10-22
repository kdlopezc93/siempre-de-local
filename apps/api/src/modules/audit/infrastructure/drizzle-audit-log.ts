import { Inject, Injectable } from '@nestjs/common';

import type { AuditEntry, AuditLog } from '../../../shared/audit/audit.port.js';
import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { auditLog } from './schema.js';

@Injectable()
export class DrizzleAuditLog implements AuditLog {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async record({ actorUserId, action, entity, entityId, teamId, meta }: AuditEntry) {
    await this.connection.db.insert(auditLog).values({
      actorUserId,
      action,
      entity,
      entityId,
      teamId: teamId ?? null,
      meta: meta ?? null,
    });
  }
}
