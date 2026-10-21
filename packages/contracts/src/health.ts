import { z } from 'zod';

/** GET /api/v1/health — estado del API y de sus dependencias. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    database: z.enum(['up', 'down']),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
