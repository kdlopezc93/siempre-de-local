import { z } from 'zod';

/** Formato de error común de la API (docs/05-api.md · Convenciones). */
export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ErrorBody = z.infer<typeof ErrorBodySchema>;
