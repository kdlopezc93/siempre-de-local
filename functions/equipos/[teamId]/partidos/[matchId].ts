// La vista previa del enlace de un partido en WhatsApp (ADR-10): a los bots, el equipo, el rival
// y la hora; a las personas, la app. La lógica y sus tests: apps/web/src/shared/link-preview.ts.
import { respondWithPreview } from '../../../../apps/web/src/shared/link-preview';

interface Context {
  request: Request;
  params: { matchId?: string | string[] };
  env: { VITE_API_URL?: string };
  next: () => Promise<Response>;
}

export const onRequestGet = ({ request, params, env, next }: Context) =>
  respondWithPreview({
    request,
    next,
    apiOrigin: env.VITE_API_URL ?? 'https://api.siempredelocal.app',
    kind: 'matches',
    id: typeof params.matchId === 'string' ? params.matchId : null,
  });
