import { z } from 'zod';

/**
 * Versión vigente de la política de tratamiento de datos (docs/legal/). Cambiarla obliga
 * a todos a aceptarla de nuevo: así se publica la versión revisada por el abogado (D7).
 */
export const POLICY_VERSION = '2026-10-borrador-3';

/** POST /api/v1/me/consent */
export const AcceptConsentRequestSchema = z.object({
  policyVersion: z.string(),
  /** Declaración de mayoría de edad: sin ella no hay alta (04 §1.2). */
  ageConfirmed: z.literal(true),
});

export const ConsentSchema = z.object({
  policyVersion: z.string(),
  acceptedAt: z.iso.datetime(),
});

export const AcceptConsentResponseSchema = z.object({ consent: ConsentSchema });

export type AcceptConsentRequest = z.infer<typeof AcceptConsentRequestSchema>;
export type Consent = z.infer<typeof ConsentSchema>;
export type AcceptConsentResponse = z.infer<typeof AcceptConsentResponseSchema>;
