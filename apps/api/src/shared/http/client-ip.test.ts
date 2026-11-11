import { describe, expect, it } from 'vitest';

import { clientIp } from './client-ip.js';

describe('clientIp (auditoría 2026-11-10, M1)', () => {
  it('en Fly, la IP que pone Fly, no la que manda el cliente en X-Forwarded-For', () => {
    expect(
      clientIp({
        headers: { 'fly-client-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.9' },
        ip: '6.6.6.6',
      }),
    ).toBe('203.0.113.9');
  });

  it('sin Fly (o con algo que no es una IP), la que resuelve Fastify', () => {
    expect(clientIp({ headers: {}, ip: '127.0.0.1' })).toBe('127.0.0.1');
    expect(clientIp({ headers: { 'fly-client-ip': 'no-soy-ip' }, ip: '10.0.0.1' })).toBe(
      '10.0.0.1',
    );
  });
});
