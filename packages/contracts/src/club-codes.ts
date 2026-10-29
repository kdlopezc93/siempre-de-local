import { z } from 'zod';

/**
 * Códigos de alta (2026-10-29): para crear un club desde la app hace falta uno, y los genera el
 * administrador de la plataforma. Cada código sirve para un club y vence.
 */

/** POST /api/v1/admin/club-codes */
export const CreateClubCodeRequestSchema = z.object({
  /** Para quién es, para reconocerlo en la lista ("Pedro, Los Tigres"). */
  note: z.string().trim().max(80).optional(),
  expiresInDays: z.int().min(1).max(60).default(14),
});

export const ClubCodeStatusSchema = z.enum(['active', 'expired', 'used', 'revoked']);

/** Un código sin el código: se ve una sola vez, al crearlo. */
export const ClubCodeSummarySchema = z.object({
  id: z.uuid(),
  note: z.string().nullable(),
  status: ClubCodeStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  /** El club que se creó con él, si ya se usó. */
  club: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export const CreateClubCodeResponseSchema = z.object({
  clubCode: ClubCodeSummarySchema,
  code: z.string(),
  /** Enlace listo para compartir: `<app>/crear-club/<código>`. */
  url: z.url(),
});

/** GET /api/v1/admin/club-codes — del más reciente al más antiguo. */
export const ClubCodeListResponseSchema = z.object({ items: z.array(ClubCodeSummarySchema) });

export type CreateClubCodeRequest = z.input<typeof CreateClubCodeRequestSchema>;
export type ClubCodeStatus = z.infer<typeof ClubCodeStatusSchema>;
export type ClubCodeSummary = z.infer<typeof ClubCodeSummarySchema>;
export type CreateClubCodeResponse = z.infer<typeof CreateClubCodeResponseSchema>;
export type ClubCodeListResponse = z.infer<typeof ClubCodeListResponseSchema>;
