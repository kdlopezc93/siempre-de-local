import { randomInt } from 'node:crypto';

import { Module } from '@nestjs/common';

import { KNOWLEDGE_QUERY } from '../squad/application/ports/squad.ports.js';
import { MY_EXAMS_QUERY } from '../account/application/ports/account.ports.js';
import { CertExams, EXAM_RANDOM } from './application/cert-exams.use-cases.js';
import { KnowledgeStaff } from './application/knowledge-staff.use-cases.js';
import { CERT_EXAMS_REPOSITORY } from './application/ports/cert-exams.repository.js';
import { CertExamsController } from './http/cert-exams.controller.js';
import { KnowledgeStaffController } from './http/knowledge-staff.controller.js';
import { DrizzleCertExamsRepository } from './infrastructure/drizzle-cert-exams.repository.js';

/** Examen de conocimiento por posición (docs/02 §6). */
@Module({
  controllers: [CertExamsController, KnowledgeStaffController],
  providers: [
    { provide: CERT_EXAMS_REPOSITORY, useClass: DrizzleCertExamsRepository },
    // Azar criptográfico: el sorteo de preguntas no debe ser predecible.
    { provide: EXAM_RANDOM, useValue: () => randomInt(0, 2 ** 32) / 2 ** 32 },
    CertExams,
    { provide: MY_EXAMS_QUERY, useExisting: CertExams },
    KnowledgeStaff,
    { provide: KNOWLEDGE_QUERY, useExisting: KnowledgeStaff },
  ],
  exports: [KNOWLEDGE_QUERY, MY_EXAMS_QUERY],
})
export class CertificationModule {}
