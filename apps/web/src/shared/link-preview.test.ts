// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { isPreviewBot, previewHtml, respondWithPreview } from './link-preview';

const PREVIEW = {
  title: 'QLeones FC vs Real Bosa',
  description: 'Sábado 7 nov, 3:00 p. m.. ¿Vas?',
  image: '/api/v1/previews/matches/m1/image.png',
};
const WHATSAPP = 'WhatsApp/2.23.20.0 A';
const PAGE = 'https://app.siempredelocal.app/equipos/t1/partidos/m1';

const request = (userAgent: string) => new Request(PAGE, { headers: { 'user-agent': userAgent } });
const app = () => Promise.resolve(new Response('la app'));

describe('vista previa de los enlaces (2026-11-06, ADR-10)', () => {
  it('reconoce los bots de vistas previas, no a las personas ni a los buscadores', () => {
    expect(isPreviewBot(WHATSAPP)).toBe(true);
    expect(isPreviewBot('facebookexternalhit/1.1')).toBe(true);
    expect(isPreviewBot('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile')).toBe(false);
    expect(isPreviewBot('Googlebot/2.1')).toBe(false);
    expect(isPreviewBot(null)).toBe(false);
  });

  it('el HTML del bot: título, descripción e imagen del API, con lo raro escapado', () => {
    const html = previewHtml(
      { ...PREVIEW, title: 'Los "Duros" & <Cía>' },
      PAGE,
      'https://api.siempredelocal.app',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://api.siempredelocal.app/api/v1/previews/matches/m1/image.png">',
    );
    expect(html).toContain('content="Los &#34;Duros&#34; &#38; &#60;Cía&#62;"');
    expect(html).not.toContain('<Cía>');
  });

  it('a WhatsApp, la vista previa; a una persona, la app', async () => {
    const fetcher = vi.fn(async (_url: URL) => Response.json(PREVIEW));
    const args = {
      next: app,
      apiOrigin: 'https://api.x',
      kind: 'matches' as const,
      id: 'm1',
      fetcher,
    };
    const bot = await respondWithPreview({ ...args, request: request(WHATSAPP) });
    expect(await bot.text()).toContain('<title>QLeones FC vs Real Bosa</title>');
    expect(String(fetcher.mock.calls[0]![0])).toBe('https://api.x/api/v1/previews/matches/m1');

    const person = await respondWithPreview({ ...args, request: request('Mozilla/5.0 Chrome') });
    expect(await person.text()).toBe('la app');
  });

  it('si el API no conoce el enlace o está caído, la app de siempre', async () => {
    const base = {
      request: request(WHATSAPP),
      next: app,
      apiOrigin: 'https://api.x',
      kind: 'charges' as const,
    };
    const missing = vi.fn(async () => new Response('', { status: 404 }));
    expect(await (await respondWithPreview({ ...base, id: 'c1', fetcher: missing })).text()).toBe(
      'la app',
    );
    const down = vi.fn(async () => Promise.reject(new TypeError('offline')));
    expect(await (await respondWithPreview({ ...base, id: 'c1', fetcher: down })).text()).toBe(
      'la app',
    );
    expect(await (await respondWithPreview({ ...base, id: null })).text()).toBe('la app');
  });
});
