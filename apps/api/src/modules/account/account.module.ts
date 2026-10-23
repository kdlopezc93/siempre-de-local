import { Module } from '@nestjs/common';

import { CertificationModule } from '../certification/certification.module.js';
import { QuizModule } from '../quiz/quiz.module.js';
import { MyData } from './application/account.use-cases.js';
import { ACCOUNT_REPOSITORY } from './application/ports/account.ports.js';
import { AccountController } from './http/account.controller.js';
import { DrizzleAccountRepository } from './infrastructure/drizzle-account.repository.js';

/** Tu cuenta: descargar tus datos y eliminarla (`04` §5). */
@Module({
  imports: [QuizModule, CertificationModule],
  controllers: [AccountController],
  providers: [{ provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository }, MyData],
})
export class AccountModule {}
