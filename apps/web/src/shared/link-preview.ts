import type { LinkPreview } from '@sdl/contracts';

/*
 * La vista previa de los enlaces (2026-11-06, ADR-10): la usan las funciones de Cloudflare Pages
 * (`/functions` en la raíz del repo). Cuando quien abre el enlace es el bot de vistas previas de
 * WhatsApp (o de otra app de mensajes), le responden con un HTML corto con el equipo, el rival y
 * la hora; a las personas, la app de siempre. Sin nada del navegador: corre en Cloudflare.
 */

/** Los bots que arman vistas previas de enlaces (no los buscadores). */
const PREVIEW_BOTS =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Iframely/i;

export const isPreviewBot = (userAgent: string | null) =>
  userAgent !== null && PREVIEW_BOTS.test(userAgent);

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** El HTML que lee el bot: las etiquetas og: y twitter: con la imagen del API. */
export function previewHtml(preview: LinkPreview, pageUrl: string, apiOrigin: string): string {
  const image = new URL(preview.image, apiOrigin).href;
  const tags = [
    ['og:type', 'website'],
    ['og:site_name', 'Siempre de Local'],
    ['og:url', pageUrl],
    ['og:title', preview.title],
    ['og:description', preview.description],
    ['og:image', image],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['og:locale', 'es_LA'],
  ]
    .map(([property, content]) => `<meta property="${property}" content="${escape(content!)}">`)
    .join('\n    ');
  return `<!doctype html>
<html lang="es-419">
  <head>
    <meta charset="utf-8">
    <title>${escape(preview.title)}</title>
    <meta name="description" content="${escape(preview.description)}">
    ${tags}
    <meta name="twitter:card" content="summary_large_image">
  </head>
  <body><a href="${escape(pageUrl)}">${escape(preview.title)}</a></body>
</html>`;
}

/**
 * Lo que hace la función: si es un bot y el API conoce el enlace, la vista previa; si no (una
 * persona, un id que no existe o el API caído), la app de siempre (`next`).
 *
 * Con `previewSecret` (la variable `PREVIEW_SECRET` de Pages, la misma que en el API), le dice
 * al API la IP de quien pregunta (`CF-Connecting-IP`): así el tope se cuenta por cliente y no
 * por la IP de Cloudflare, que comparten todos (auditoría 2026-11-11).
 */
export async function respondWithPreview({
  request,
  next,
  apiOrigin,
  kind,
  id,
  previewSecret,
  fetcher = (url, init) => fetch(url, init),
}: {
  request: Request;
  next: () => Promise<Response>;
  apiOrigin: string;
  kind: 'matches' | 'charges';
  id: string | null;
  previewSecret?: string | undefined;
  fetcher?: (url: URL, init: RequestInit) => Promise<Response>;
}): Promise<Response> {
  if (!id || !isPreviewBot(request.headers.get('user-agent'))) return next();
  const clientIp = request.headers.get('cf-connecting-ip');
  const headers: Record<string, string> =
    previewSecret && clientIp
      ? { 'x-preview-key': previewSecret, 'x-preview-client-ip': clientIp }
      : {};
  try {
    const res = await fetcher(
      new URL(`/api/v1/previews/${kind}/${encodeURIComponent(id)}`, apiOrigin),
      { headers },
    );
    if (!res.ok) return next();
    const preview = (await res.json()) as LinkPreview;
    return new Response(previewHtml(preview, request.url, apiOrigin), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch {
    return next();
  }
}
