import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ConfigModule } from './config/config.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';
import { RatingsModule } from './modules/ratings/ratings.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { CertificationModule } from './modules/certification/certification.module.js';
import { LineupsModule } from './modules/lineups/lineups.module.js';
import { TeamDataModule } from './modules/team-data/team-data.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PlayerProfileModule } from './modules/player-profile/player-profile.module.js';
import { QuestionnairesModule } from './modules/questionnaires/questionnaires.module.js';
import { QuizModule } from './modules/quiz/quiz.module.js';
import { SquadModule } from './modules/squad/squad.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { PermissionGuard } from './shared/authz/permission.guard.js';
import { SessionGuard } from './shared/authz/session.guard.js';
import { DbModule } from './shared/db/db.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    IdentityModule,
    TeamsModule,
    PlayerProfileModule,
    QuestionnairesModule,
    QuizModule,
    AssessmentsModule,
    RatingsModule,
    AuditModule,
    CertificationModule,
    LineupsModule,
    TeamDataModule,
    SquadModule,
    HealthModule,
  ],
  // En este orden: primero la sesión, después los permisos de @Can.
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
