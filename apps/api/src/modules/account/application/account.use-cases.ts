import { Inject, Injectable } from '@nestjs/common';
import type { MyDataExport } from '@sdl/contracts';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  MEMBERSHIPS_QUERY,
  type MembershipsQuery,
} from '../../identity/application/ports/memberships.query.js';
import {
  PROFILE_QUERY,
  type ProfileQuery,
} from '../../identity/application/ports/profile.query.js';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  MY_ATTEMPTS_QUERY,
  MY_EXAMS_QUERY,
  type MyAttemptsQuery,
  type MyExamsQuery,
} from './ports/account.ports.js';

type User = { id: string; name: string };

/** Tus datos (07 §4.5, `04` §5): descargarlos y eliminar tu cuenta. */
@Injectable()
export class MyData {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROFILE_QUERY) private readonly profiles: ProfileQuery,
    @Inject(MEMBERSHIPS_QUERY) private readonly memberships: MembershipsQuery,
    @Inject(MY_ATTEMPTS_QUERY) private readonly attempts: MyAttemptsQuery,
    @Inject(MY_EXAMS_QUERY) private readonly exams: MyExamsQuery,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async export(user: User): Promise<MyDataExport> {
    const account = await this.accounts.account(user.id);
    if (!account) throw new NotFoundError('Cuenta no encontrada');
    const [
      profile,
      consents,
      memberships,
      orientationTests,
      knowledgeExams,
      cards,
      assessments,
      matches,
    ] = await Promise.all([
      this.profiles.profileOf(user),
      this.accounts.consents(user.id),
      this.memberships.listForUser(user.id),
      this.attempts.list(user.id),
      this.exams.myExams(user.id),
      this.accounts.cardsAbout(user.id),
      this.accounts.assessmentsAbout(user.id),
      this.accounts.matchesOf(user.id),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: { ...account, createdAt: account.createdAt.toISOString() },
      profile,
      consents,
      memberships,
      orientationTests,
      knowledgeExams,
      cards,
      assessments,
      matches,
    };
  }

  /**
   * Elimina la cuenta y todo lo suyo. No deja a un club sin quien lo maneje: si es su único
   * dueño o admin, primero tiene que nombrar a otro.
   */
  async delete(user: User): Promise<void> {
    const orphaned = await this.accounts.clubsOnlyManagedBy(user.id);
    if (orphaned.length > 0) {
      throw new ConflictError(
        `Eres quien maneja ${orphaned.join(', ')}. Antes de eliminar tu cuenta, deja a otra persona como dueña o administradora del club.`,
        'LAST_CLUB_ADMIN',
      ).with({ clubs: orphaned });
    }
    // Queda constancia de que se pidió, sin datos personales (el autor se borra con la cuenta).
    await this.audit.record({
      actorUserId: user.id,
      action: 'account.deleted',
      entity: 'user',
      entityId: user.id,
      meta: {},
    });
    await this.accounts.deleteUser(user.id);
  }
}
