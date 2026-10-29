import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

import { POLICY_VERSION, type PositionCode, type SubmitAttemptRequest } from '@sdl/contracts';
import {
  bandFor,
  ELIGIBLE_POSITIONS,
  ORIENTATION_SCORING_VERSION,
  positionAverages,
  type RatingValues,
  scorePosition,
} from '@sdl/domain';
import { and, eq } from 'drizzle-orm';

import {
  certArea,
  certBankVersion,
  certExam,
} from '../modules/certification/infrastructure/schema.js';
import { DrizzleAssessmentsRepository } from '../modules/assessments/infrastructure/drizzle-assessments.repository.js';
import { dataConsent } from '../modules/identity/infrastructure/consent.schema.js';
import { user } from '../modules/identity/infrastructure/schema.js';
import {
  playerPreferredPosition,
  playerProfile,
} from '../modules/player-profile/infrastructure/schema.js';
import { DrizzleRatingsRepository } from '../modules/ratings/infrastructure/drizzle-ratings.repository.js';
import { DrizzleQuestionnaireReader } from '../modules/questionnaires/infrastructure/drizzle-questionnaire.reader.js';
import { positionPart } from '../modules/quiz/application/validate-submission.js';
import { DrizzleAttemptsRepository } from '../modules/quiz/infrastructure/drizzle-attempts.repository.js';
import { quizAttempt } from '../modules/quiz/infrastructure/schema.js';
import { team, teamMembership } from '../modules/teams/infrastructure/schema.js';
import { createDb, type DbConnection } from '../shared/db/client.js';

/**
 * pnpm admin:seed-demo -- --team-id <uuid>
 *
 * Llena un equipo con jugadores de demostración para ver el panel del cuerpo técnico:
 * perfiles con preferidas, tests hechos con el algoritmo real, un asistente que ya valoró
 * a algunos y les puntuó la tarjeta a todos, y exámenes de conocimiento de las posiciones
 * publicadas (con puntajes que acompañan a la tarjeta, para el informe de validación).
 * Con `--coach-email` ese miembro del cuerpo técnico también valora a ciegas a los demo, para
 * verlos contados desde su cuenta. Idempotente. Nunca en producción. Los correos terminan en
 * @demo.siempredelocal.
 */
const DOMAIN = 'demo.siempredelocal';

interface DemoPlayer {
  name: string;
  jersey: number;
  /** Hacia dónde apuntan sus respuestas del test (null: no lo hizo). */
  testLeaning: PositionCode | null;
  preferred: PositionCode[];
  /** Lo que el asistente demo ya valoró (null: sin valorar). */
  staff: { primary: PositionCode; secondary: PositionCode[]; confidence: number } | null;
}

const PLAYERS: DemoPlayer[] = [
  {
    name: 'Julio César',
    jersey: 1,
    testLeaning: 'POR',
    preferred: ['POR'],
    staff: { primary: 'POR', secondary: [], confidence: 5 },
  },
  {
    name: 'Cristian Mora',
    jersey: 4,
    testLeaning: 'DFC',
    preferred: ['DFC', 'MCD'],
    staff: { primary: 'DFC', secondary: ['MCD'], confidence: 4 },
  },
  {
    name: 'Andrés Pineda',
    jersey: 2,
    testLeaning: 'LAT',
    preferred: ['LAT', 'EXT'],
    staff: { primary: 'LAT', secondary: ['EXT'], confidence: 4 },
  },
  {
    name: 'Samuel Ortiz',
    jersey: 3,
    testLeaning: 'DFC',
    preferred: ['LAT'],
    staff: { primary: 'LAT', secondary: ['DFC'], confidence: 3 },
  },
  {
    name: 'Ronnie Vargas',
    jersey: 5,
    testLeaning: 'MCD',
    preferred: ['MC', 'MCD'],
    staff: { primary: 'DFC', secondary: ['MCD'], confidence: 3 },
  },
  {
    name: 'Julián Jiménez',
    jersey: 8,
    testLeaning: 'MC',
    preferred: ['MC'],
    staff: { primary: 'MC', secondary: ['MP'], confidence: 4 },
  },
  {
    name: 'Mateo Rincón',
    jersey: 10,
    testLeaning: 'MP',
    preferred: ['MP', 'MC'],
    staff: { primary: 'MC', secondary: ['MP'], confidence: 4 },
  },
  {
    name: 'Gabriel Bobadilla',
    jersey: 7,
    testLeaning: 'EXT',
    preferred: ['EXT', 'DC'],
    staff: { primary: 'EXT', secondary: ['LAT'], confidence: 2 },
  },
  {
    name: 'Daniel Quintero',
    jersey: 9,
    testLeaning: 'DC',
    preferred: ['DC'],
    staff: { primary: 'DC', secondary: [], confidence: 5 },
  },
  {
    name: 'Cristian Meza',
    jersey: 11,
    testLeaning: 'EXT',
    preferred: ['DC', 'EXT'],
    staff: { primary: 'DC', secondary: [], confidence: 3 },
  },
  { name: 'Felipe Arango', jersey: 6, testLeaning: null, preferred: ['MCD'], staff: null },
  { name: 'Brayan Salazar', jersey: 14, testLeaning: null, preferred: ['EXT'], staff: null },
  { name: 'Óscar Lozano', jersey: 15, testLeaning: null, preferred: [], staff: null },
  { name: 'Wilmer Castro', jersey: 12, testLeaning: null, preferred: ['POR'], staff: null },
];

/** Perfil típico de cada posición para la tarjeta demo (se le suma un poco de ruido). */
const CARD_BASE: Record<PositionCode, RatingValues> = {
  POR: {
    PAC: 50,
    SHO: 35,
    PAS: 55,
    DRI: 40,
    DEF: 45,
    PHY: 66,
    GK_DIV: 74,
    GK_HAN: 70,
    GK_KIC: 62,
    GK_REF: 78,
    GK_SPD: 72,
    GK_POS: 70,
  },
  LAT: { PAC: 74, SHO: 45, PAS: 62, DRI: 60, DEF: 66, PHY: 64 },
  DFC: { PAC: 60, SHO: 40, PAS: 58, DRI: 45, DEF: 78, PHY: 75 },
  MCD: { PAC: 58, SHO: 50, PAS: 70, DRI: 58, DEF: 72, PHY: 70 },
  MC: { PAC: 60, SHO: 62, PAS: 76, DRI: 66, DEF: 58, PHY: 62 },
  MP: { PAC: 66, SHO: 70, PAS: 78, DRI: 76, DEF: 40, PHY: 55 },
  EXT: { PAC: 82, SHO: 64, PAS: 62, DRI: 78, DEF: 35, PHY: 58 },
  DC: { PAC: 70, SHO: 78, PAS: 55, DRI: 66, DEF: 30, PHY: 72 },
};

const ASSISTANT = { name: 'Profe Demo', email: `asistente@${DOMAIN}` };

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.');

/** Azar con semilla: los mismos datos en cada base. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

async function ensureUser(conn: DbConnection, name: string, email: string): Promise<string> {
  await conn.db
    .insert(user)
    .values({ name, email, emailVerified: true })
    .onConflictDoNothing({ target: user.email });
  const [row] = await conn.db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const userId = row!.id;
  const [consent] = await conn.db
    .select({ id: dataConsent.id })
    .from(dataConsent)
    .where(and(eq(dataConsent.userId, userId), eq(dataConsent.policyVersion, POLICY_VERSION)));
  if (!consent) {
    await conn.db
      .insert(dataConsent)
      .values({ userId, policyVersion: POLICY_VERSION, ageConfirmed: true });
  }
  return userId;
}

async function ensureMembership(
  conn: DbConnection,
  teamId: string,
  userId: string,
  role: 'player' | 'assistant',
  jerseyNumber: number | null,
) {
  await conn.db
    .insert(teamMembership)
    .values({ teamId, userId, role, jerseyNumber })
    .onConflictDoNothing();
}

/** El miembro del cuerpo técnico (coach o assistant) del equipo con ese correo. */
async function staffMember(conn: DbConnection, teamId: string, email: string): Promise<string> {
  const rows = await conn.db
    .select({ id: user.id, role: teamMembership.role })
    .from(user)
    .innerJoin(teamMembership, eq(teamMembership.userId, user.id))
    .where(and(eq(user.email, email), eq(teamMembership.teamId, teamId)));
  const staff = rows.find((r) => r.role === 'coach' || r.role === 'assistant');
  if (!staff) throw new Error(`${email} no es del cuerpo técnico de este equipo`);
  return staff.id;
}

/**
 * Exámenes de conocimiento de las posiciones publicadas: el puntaje sigue a la media de la
 * tarjeta en esa posición, con más ruido en unas que en otras (así el informe muestra
 * relaciones distintas). No a todos: unos no se presentan.
 */
async function seedKnowledge(
  conn: DbConnection,
  teamId: string,
  playerIds: readonly string[],
  cards: ReadonlyMap<string, RatingValues>,
): Promise<number> {
  const banks = await conn.db
    .select()
    .from(certBankVersion)
    .where(eq(certBankVersion.status, 'published'));
  let created = 0;
  for (const [b, bank] of banks.entries()) {
    const areas = await conn.db
      .select({ code: certArea.code })
      .from(certArea)
      .where(eq(certArea.position, bank.position));
    const noise = b % 2 === 0 ? 0.08 : 0.3;
    for (const [i, userId] of playerIds.entries()) {
      if ((i + b) % 4 === 3) continue;
      const average = positionAverages(cards.get(userId) ?? {})[bank.position];
      if (average === undefined) continue;
      const [taken] = await conn.db
        .select({ id: certExam.id })
        .from(certExam)
        .where(and(eq(certExam.userId, userId), eq(certExam.position, bank.position)));
      if (taken) continue;
      const random = seeded(1000 + 31 * b + i);
      const total = bank.itemsPerExam;
      const pct = Math.max(0.1, Math.min(1, (average - 35) / 50 + (random() - 0.5) * 2 * noise));
      const score = Math.round(pct * total);
      const byArea = areas.map((a, k) => {
        const areaTotal = Math.floor(total / areas.length) + (k < total % areas.length ? 1 : 0);
        return { area: a.code, total: areaTotal, correct: 0 };
      });
      for (let left = score, k = 0; left > 0; k = (k + 1) % byArea.length) {
        if (byArea[k]!.correct < byArea[k]!.total) {
          byArea[k]!.correct++;
          left--;
        }
      }
      const startedAt = new Date(Date.now() - (10 + i + b * 3) * 24 * 60 * 60 * 1000);
      const submittedAt = new Date(startedAt.getTime() + 14 * 60 * 1000);
      await conn.db.insert(certExam).values({
        userId,
        teamId,
        bankVersionId: bank.id,
        position: bank.position,
        status: 'submitted',
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + bank.timeLimitS * 1000),
        nextAttemptAt: new Date(startedAt.getTime() + bank.attemptIntervalDays * 86_400_000),
        submittedAt,
        endedBy: 'submit',
        score,
        total,
        pct: score / total,
        band: bandFor(score / total),
        byArea,
      });
      created++;
    }
  }
  return created;
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { 'team-id': { type: 'string' }, 'coach-email': { type: 'string' } },
});
const teamId = values['team-id'];
if (!teamId) {
  console.error('Uso: pnpm admin:seed-demo -- --team-id <uuid> [--coach-email <correo>]');
  process.exit(1);
}
if (process.env['NODE_ENV'] === 'production') {
  console.error('Los datos de demostración no se cargan en producción.');
  process.exit(1);
}
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const conn = createDb(databaseUrl);
try {
  const [found] = await conn.db
    .select({ id: team.id, name: team.name, format: team.format })
    .from(team)
    .where(eq(team.id, teamId));
  if (!found) throw new Error(`No existe el equipo ${teamId}`);

  const questionnaires = new DrizzleQuestionnaireReader(conn);
  const versionId = await questionnaires.currentPublishedId();
  const content = versionId ? await questionnaires.load(versionId) : null;
  if (!content) throw new Error('No hay cuestionario publicado: corre antes pnpm db:seed');

  const attempts = new DrizzleAttemptsRepository(conn);
  const assessments = new DrizzleAssessmentsRepository(conn);
  const ratings = new DrizzleRatingsRepository(conn);
  const carded = await ratings.latestByTeam(found.id);
  const assistantId = await ensureUser(conn, ASSISTANT.name, ASSISTANT.email);
  await ensureMembership(conn, found.id, assistantId, 'assistant', null);
  const alreadyAssessed = await assessments.assessedBy(assistantId, found.id);
  const eligible = new Set<PositionCode>(ELIGIBLE_POSITIONS[found.format]);
  const coach = values['coach-email']
    ? await staffMember(conn, found.id, values['coach-email'])
    : null;
  const coachAssessed = coach ? await assessments.assessedBy(coach, found.id) : new Set<string>();
  const cardOf = new Map<string, RatingValues>(
    [...carded].map(([playerId, card]) => [playerId, card.values]),
  );

  let cards = 0;
  let tests = 0;
  let rated = 0;
  let coachRated = 0;
  const playerIds: string[] = [];
  for (const [i, demo] of PLAYERS.entries()) {
    const userId = await ensureUser(conn, demo.name, `${slug(demo.name)}@${DOMAIN}`);
    await ensureMembership(conn, found.id, userId, 'player', demo.jersey);
    await conn.db
      .insert(playerProfile)
      .values({ userId, displayName: demo.name, playsGoalkeeper: demo.preferred.includes('POR') })
      .onConflictDoNothing();
    const [hasPreferred] = await conn.db
      .select({ userId: playerPreferredPosition.userId })
      .from(playerPreferredPosition)
      .where(eq(playerPreferredPosition.userId, userId));
    if (!hasPreferred && demo.preferred.length) {
      await conn.db
        .insert(playerPreferredPosition)
        .values(demo.preferred.map((position, rank) => ({ userId, position, rank: rank + 1 })));
    }

    const [hasAttempt] = await conn.db
      .select({ id: quizAttempt.id })
      .from(quizAttempt)
      .where(and(eq(quizAttempt.userId, userId), eq(quizAttempt.teamId, found.id)));
    if (demo.testLeaning && !hasAttempt) {
      // Responde como alguien de su posición: casi siempre la opción que más le suma.
      const random = seeded(i + 1);
      const shown = [...content.positionItems]
        .sort(() => random() - 0.5)
        .slice(0, content.positionItemsPerAttempt);
      const lean = demo.testLeaning;
      const submittedAt = new Date(Date.now() - (i + 1) * 36 * 60 * 60 * 1000);
      const request: SubmitAttemptRequest = {
        clientAttemptId: randomUUID(),
        teamId: found.id,
        questionnaireVersionId: content.versionId,
        format: found.format,
        startedAt: new Date(submittedAt.getTime() - 6 * 60 * 1000).toISOString(),
        submittedAt: submittedAt.toISOString(),
        positionItems: shown.map((item, order) => {
          const byFit = [...item.options].sort(
            (a, b) => (b.points[lean] ?? 0) - (a.points[lean] ?? 0),
          );
          const answer = random() < 0.8 ? byFit[0]! : byFit[1]!;
          return {
            itemId: item.id,
            shownOrder: order + 1,
            optionOrder: item.options.map((o) => o.id),
            answerOptionId: answer.id,
          };
        }),
      };
      const position = positionPart(content, request);
      const ranking = scorePosition(position.items, position.answers, found.format);
      await attempts.save({
        userId,
        request,
        scoringVersion: ORIENTATION_SCORING_VERSION,
        result: { ranking },
        receivedAt: submittedAt,
      });
      tests++;
    }

    // En F8 solo se valoran las posiciones del formato.
    if (demo.staff && !alreadyAssessed.has(userId) && eligible.has(demo.staff.primary)) {
      await assessments.create({
        teamId: found.id,
        playerUserId: userId,
        coachUserId: assistantId,
        primaryPosition: demo.staff.primary,
        secondaryPositions: demo.staff.secondary.filter((pos) => eligible.has(pos)),
        confidence: demo.staff.confidence,
        blind: true,
        notes: null,
      });
      rated++;
    }
    // El mismo criterio de primera vista, a nombre del entrenador que lo pidió.
    if (coach && demo.staff && !coachAssessed.has(userId) && eligible.has(demo.staff.primary)) {
      await assessments.create({
        teamId: found.id,
        playerUserId: userId,
        coachUserId: coach,
        primaryPosition: demo.staff.primary,
        secondaryPositions: demo.staff.secondary.filter((pos) => eligible.has(pos)),
        confidence: demo.staff.confidence,
        blind: true,
        notes: null,
      });
      coachRated++;
    }

    // Y a todos les puntúa la tarjeta según su posición, con ruido para que no sean iguales.
    if (!carded.has(userId)) {
      const random = seeded(100 + i);
      const base =
        demo.staff?.primary ?? demo.testLeaning ?? demo.preferred[0] ?? ('MC' as PositionCode);
      const values = Object.fromEntries(
        Object.entries(CARD_BASE[base]).map(([code, base]) => [
          code,
          Math.max(0, Math.min(99, base! + Math.round((random() - 0.5) * 14))),
        ]),
      ) as RatingValues;
      await ratings.create({
        teamId: found.id,
        playerUserId: userId,
        ratedBy: assistantId,
        values,
        notes: null,
        position: base,
      });
      cardOf.set(userId, values);
      cards++;
    }
    playerIds.push(userId);
  }

  const exams = await seedKnowledge(conn, found.id, playerIds, cardOf);
  console.log(
    `${found.name}: ${PLAYERS.length} jugadores de demostración, ${tests} tests nuevos, ${rated} valoraciones y ${cards} tarjetas del asistente "${ASSISTANT.name}", ${exams} exámenes de conocimiento` +
      (coach ? ` y ${coachRated} valoraciones a ciegas de ${values['coach-email']}.` : '.'),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await conn.pool.end();
}
