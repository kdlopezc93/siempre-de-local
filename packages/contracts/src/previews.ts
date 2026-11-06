import { z } from 'zod';

/**
 * GET /previews/matches/:matchId y /previews/charges/:chargeId — la vista previa de un enlace
 * de la app en WhatsApp (2026-11-06, nivel 2). Públicas: solo el equipo, el rival y la hora (o
 * de qué es un cobro, nunca cuánto); nunca nombres de jugadores.
 */
export const LinkPreviewSchema = z.object({
  title: z.string(),
  description: z.string(),
  /** La imagen 1200×630, en el mismo API. */
  image: z.string(),
});
export type LinkPreview = z.infer<typeof LinkPreviewSchema>;
