import { Global, Module } from '@nestjs/common';

import { AUDIT_LOG } from '../../shared/audit/audit.port.js';
import { DrizzleAuditLog } from './infrastructure/drizzle-audit-log.js';

/** Global: cualquier caso de uso registra en audit_log por el puerto AUDIT_LOG. */
@Global()
@Module({
  providers: [{ provide: AUDIT_LOG, useClass: DrizzleAuditLog }],
  exports: [AUDIT_LOG],
})
export class AuditModule {}
