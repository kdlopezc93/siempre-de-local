// La vista previa del enlace de un cobro (`mis-cuentas?cobro=`) en WhatsApp (ADR-10): a los
// bots, de qué es (nunca cuánto); a las personas, la app. Lógica: apps/web/src/shared/link-preview.ts.
import { respondWithPreview } from '../../../apps/web/src/shared/link-preview';

interface Context {
  request: Request;
  env: { VITE_API_URL?: string; PREVIEW_SECRET?: string };
  next: () => Promise<Response>;
}

export const onRequestGet = ({ request, env, next }: Context) =>
  respondWithPreview({
    request,
    next,
    apiOrigin: env.VITE_API_URL ?? 'https://api.siempredelocal.app',
    previewSecret: env.PREVIEW_SECRET,
    kind: 'charges',
    id: new URL(request.url).searchParams.get('cobro'),
  });
