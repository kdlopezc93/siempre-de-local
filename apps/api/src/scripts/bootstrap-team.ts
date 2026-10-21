import { parseArgs } from 'node:util';

import { z } from 'zod';

import {
  bootstrapTeam,
  BootstrapTeamInputSchema,
} from '../modules/teams/infrastructure/bootstrap-team.js';
import { createDb } from '../shared/db/client.js';

/**
 * pnpm admin:bootstrap-team -- --club-name "Los del Barrio" --club-slug los-del-barrio \
 *   --team-name "Primer equipo" --format F11 --season 2026 \
 *   --owner-email dueno@gmail.com --coach-email profe@gmail.com
 */
const { values } = parseArgs({
  // pnpm reenvía el `--` separador; no es un argumento.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    'club-name': { type: 'string' },
    'club-slug': { type: 'string' },
    'team-name': { type: 'string' },
    format: { type: 'string' },
    season: { type: 'string' },
    'owner-email': { type: 'string' },
    'coach-email': { type: 'string' },
  },
});

const input = BootstrapTeamInputSchema.safeParse({
  clubName: values['club-name'],
  clubSlug: values['club-slug'],
  teamName: values['team-name'],
  format: values.format,
  season: values.season,
  ownerEmail: values['owner-email'],
  coachEmail: values['coach-email'],
});
if (!input.success) {
  console.error(`Parámetros inválidos:\n${z.prettifyError(input.error)}`);
  process.exit(1);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const { db, pool } = createDb(databaseUrl);
try {
  const { clubId, teamId } = await bootstrapTeam(db, input.data);
  console.log(`Club ${clubId} y equipo ${teamId} listos.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
