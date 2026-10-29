import { z } from 'zod';

import { MatchFormatSchema, TeamRoleSchema } from './teams.js';

/** POST /api/v1/teams/:teamId/invitations */
export const CreateInvitationRequestSchema = z.object({
  role: TeamRoleSchema.default('player'),
  /**
   * Cuerpo técnico que también juega (2026-10-29): al aceptar entra además como jugador. En las
   * de jugador no aplica. Las de entrenador sirven para una sola persona y pasan el mando.
   */
  alsoPlays: z.boolean().default(false),
  expiresInDays: z.int().min(1).max(30).default(7),
  /** 1 = individual; por defecto alcanza para un equipo completo. */
  maxUses: z.int().min(1).max(100).default(30),
});

export const InvitationStatusSchema = z.enum(['active', 'expired', 'used_up', 'revoked']);

/** Una invitación sin su código: el código solo se devuelve al crearla. */
export const InvitationSummarySchema = z.object({
  id: z.uuid(),
  role: TeamRoleSchema,
  alsoPlays: z.boolean(),
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
  role: TeamRoleSchema,
  /** Entra también como jugador. */
  alsoPlays: z.boolean(),
});

/** POST /api/v1/invitations/:code/accept */
export const AcceptInvitationResponseSchema = z.object({
  teamId: z.uuid(),
  role: TeamRoleSchema,
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
