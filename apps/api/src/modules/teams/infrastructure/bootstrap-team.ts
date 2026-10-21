import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../../shared/db/client.js';
import { user } from '../../identity/infrastructure/schema.js';
import { club, clubMembership, team, teamMembership } from './schema.js';

export const BootstrapTeamInputSchema = z.object({
  clubName: z.string().trim().min(2),
  clubSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'solo minúsculas, números y guiones'),
  teamName: z.string().trim().min(2),
  format: z.enum(['F8', 'F11']),
  season: z.string().trim().min(4),
  ownerEmail: z.email(),
  coachEmail: z.email(),
});

export type BootstrapTeamInput = z.infer<typeof BootstrapTeamInputSchema>;

export class MissingUsersError extends Error {
  override readonly name = 'MissingUsersError';
}

/**
 * Alta inicial de un club con su dueño y un equipo con su entrenador (04 §1.2: los
 * admins de club se crean por script). Idempotente: repetirlo no duplica nada.
 * Las personas deben haber entrado al menos una vez con Google.
 */
export async function bootstrapTeam(db: Database, input: BootstrapTeamInput) {
  const emails = [...new Set([input.ownerEmail, input.coachEmail].map((e) => e.toLowerCase()))];
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.email, emails));
  const idByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const missing = emails.filter((email) => !idByEmail.has(email));
  if (missing.length > 0) {
    throw new MissingUsersError(
      `Todavía no han entrado a la app: ${missing.join(', ')}. Pídeles que entren una vez con Google.`,
    );
  }
  const ownerId = idByEmail.get(input.ownerEmail.toLowerCase())!;
  const coachId = idByEmail.get(input.coachEmail.toLowerCase())!;

  return db.transaction(async (tx) => {
    await tx
      .insert(club)
      .values({ name: input.clubName, slug: input.clubSlug })
      .onConflictDoNothing({ target: club.slug });
    const [{ clubId }] = (await tx
      .select({ clubId: club.id })
      .from(club)
      .where(eq(club.slug, input.clubSlug))) as [{ clubId: string }];

    await tx
      .insert(clubMembership)
      .values({ clubId, userId: ownerId, role: 'owner' })
      .onConflictDoNothing();

    await tx
      .insert(team)
      .values({ clubId, name: input.teamName, format: input.format, season: input.season })
      .onConflictDoNothing();
    const [{ teamId }] = (await tx
      .select({ teamId: team.id })
      .from(team)
      .where(
        and(eq(team.clubId, clubId), eq(team.name, input.teamName), eq(team.season, input.season)),
      )) as [{ teamId: string }];

    await tx
      .insert(teamMembership)
      .values({ teamId, userId: coachId, role: 'coach' })
      .onConflictDoNothing();

    return { clubId, teamId };
  });
}
