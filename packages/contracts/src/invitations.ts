import { z } from 'zod';

import {
  BirthYearsSchema,
  CategoryGenderSchema,
  InvitationRoleSchema,
  MatchFormatSchema,
} from './teams.js';

/** POST /api/v1/teams/:teamId/invitations */
export const CreateInvitationRequestSchema = z.object({
  role: InvitationRoleSchema.default('player'),
  /**
   * Cuerpo técnico que también juega (2026-10-29): al aceptar entra además como jugador. En las
   * de jugador no aplica. Las de entrenador sirven para una sola persona y pasan el mando.
   */
  alsoPlays: z.boolean().default(false),
  /**
   * Para acudientes (escuelas, 2026-11-08): quien la abre inscribe a su hijo menor; solo de
   * jugador y en un grupo de escuela.
   */
  forGuardians: z.boolean().default(false),
  expiresInDays: z.int().min(1).max(30).default(7),
  /** 1 = individual; por defecto alcanza para un equipo completo. */
  maxUses: z.int().min(1).max(100).default(30),
});

export const InvitationStatusSchema = z.enum(['active', 'expired', 'used_up', 'revoked']);

/** Una invitación sin su código: el código solo se devuelve al crearla. */
export const InvitationSummarySchema = z.object({
  id: z.uuid(),
  role: InvitationRoleSchema,
  alsoPlays: z.boolean(),
  forGuardians: z.boolean().default(false),
  status: InvitationStatusSchema,
  expiresAt: z.iso.datetime(),
  maxUses: z.int(),
  usedCount: z.int(),
  createdAt: z.iso.datetime(),
});

export const CreateInvitationResponseSchema = z.object({
  invitation: InvitationSummarySchema,
  code: z.string(),
  /** Enlace listo para compartir: `<app>/unirse/<código>`. */
  joinUrl: z.url(),
});

/** GET /api/v1/teams/:teamId/invitations */
export const InvitationListResponseSchema = z.object({ items: z.array(InvitationSummarySchema) });

/** GET /api/v1/invitations/:code — público: qué equipo invita y con qué rol. */
export const InvitationPreviewResponseSchema = z.object({
  team: z.object({ id: z.uuid(), name: z.string(), format: MatchFormatSchema }),
  club: z.object({ name: z.string() }),
  role: InvitationRoleSchema,
  /** Entra también como jugador. */
  alsoPlays: z.boolean(),
  /** Para acudientes: inscribe a su hijo, no entra él (2026-11-08). */
  forGuardians: z.boolean().default(false),
  /** Los años de nacimiento del grupo, si es de escuela. */
  birthYears: BirthYearsSchema.nullable().default(null),
  /** El género del grupo, si es de escuela (2026-11-10): "inscribe a tu hija". */
  gender: CategoryGenderSchema.nullable().default(null),
});

/** POST /api/v1/invitations/:code/accept */
export const AcceptInvitationResponseSchema = z.object({
  teamId: z.uuid(),
  role: InvitationRoleSchema,
  /** true si ya era miembro con ese rol: no se gasta un uso. */
  alreadyMember: z.boolean(),
});

export type CreateInvitationRequest = z.input<typeof CreateInvitationRequestSchema>;
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;
export type InvitationSummary = z.infer<typeof InvitationSummarySchema>;
export type CreateInvitationResponse = z.infer<typeof CreateInvitationResponseSchema>;
export type InvitationListResponse = z.infer<typeof InvitationListResponseSchema>;
export type InvitationPreviewResponse = z.infer<typeof InvitationPreviewResponseSchema>;
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;
