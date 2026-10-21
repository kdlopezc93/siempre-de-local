import type { IncomingHttpHeaders } from 'node:http';

/** Convierte las cabeceras de Node/Fastify a `Headers` web. */
export function toWebHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }
  return headers;
}
