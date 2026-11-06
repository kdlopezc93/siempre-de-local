import { describe, expect, it } from 'vitest';

import { loginPath, safeReturn } from './return-path';

describe('volver después de entrar (2026-11-06)', () => {
  it('solo a rutas de la app', () => {
    expect(safeReturn('/equipos/x/partidos/y?a=1')).toBe('/equipos/x/partidos/y?a=1');
    for (const bad of [null, '', 'https://otro.com', '//otro.com', '/\\otro.com', 'equipos']) {
      expect(safeReturn(bad)).toBe('/');
    }
  });

  it('el inicio va a /entrar sin más; otra pantalla, con ?volver=', () => {
    expect(loginPath('/')).toBe('/entrar');
    expect(loginPath('//otro.com')).toBe('/entrar');
    expect(loginPath('/equipos/x/mis-cuentas')).toBe('/entrar?volver=%2Fequipos%2Fx%2Fmis-cuentas');
  });
});
