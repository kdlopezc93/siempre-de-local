import { z } from 'zod';

const ClientEnvSchema = z.object({
  VITE_API_URL: z.url({ protocol: /^https?$/ }),
});

const parsed = ClientEnvSchema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`Falta configurar apps/web/.env:\n${z.prettifyError(parsed.error)}`);
}

export const API_URL = parsed.data.VITE_API_URL;
