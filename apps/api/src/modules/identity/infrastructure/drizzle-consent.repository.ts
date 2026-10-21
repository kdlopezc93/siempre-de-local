import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type { ConsentRecord, ConsentRepository } from '../application/ports/consent.repository.js';
import { dataConsent } from './consent.schema.js';

const RECORD = { policyVersion: dataConsent.policyVersion, acceptedAt: dataConsent.acceptedAt };

@Injectable()
export class DrizzleConsentRepository implements ConsentRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async findActive(userId: string, policyVersion: string): Promise<ConsentRecord | null> {
    const [row] = await this.connection.db
      .select(RECORD)
      .from(dataConsent)
      .where(
        and(
          eq(dataConsent.userId, userId),
          eq(dataConsent.policyVersion, policyVersion),
          isNull(dataConsent.revokedAt),
        ),
      )
      .orderBy(desc(dataConsent.acceptedAt))
      .limit(1);
    return row ?? null;
  }

  async record(userId: string, policyVersion: string, at: Date): Promise<ConsentRecord> {
    const [row] = await this.connection.db
      .insert(dataConsent)
      .values({ userId, policyVersion, acceptedAt: at, ageConfirmed: true })
      .returning(RECORD);
    return row!;
  }
}
