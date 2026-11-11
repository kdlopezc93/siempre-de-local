import { describe, expect, it, vi } from 'vitest';

import { guardianUrl } from './guardian-notice.js';
import { Notifications } from './notifications.use-cases.js';
import type {
  PushSender,
  StoredSubscription,
  SubscriptionsRepository,
} from './ports/push.ports.js';

const sub = (endpoint: string): StoredSubscription => ({ endpoint, p256dh: 'k', auth: 'a' });
const MESSAGE = {
  kind: 'match-called' as const,
  opponent: 'Los Pibes',
  startsAt: '2026-11-01T15:00:00.000Z',
  url: '/equipos/t/partidos/m',
};

function setup(sender: Partial<PushSender>) {
  const repo: SubscriptionsRepository = {
    save: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    guardiansOf: vi.fn(async () => []),
    forUsers: vi.fn(async () => [
      sub('https://fcm.googleapis.com/fcm/send/a'),
      sub('https://fcm.googleapis.com/fcm/send/b'),
      sub('https://fcm.googleapis.com/fcm/send/c'),
    ]),
    forget: vi.fn(),
  };
  const full: PushSender = {
    publicKey: () => 'clave',
    send: vi.fn(async () => 'sent' as const),
    ...sender,
  };
  return { repo, sender: full, notifications: new Notifications(repo, full) };
}

describe('avisos (D16)', () => {
  it('sin llaves VAPID no hace nada', async () => {
    const { notifications, sender, repo } = setup({ publicKey: () => null });
    await notifications.notifyUsers(['ana'], MESSAGE);
    expect(repo.forUsers).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('manda a cada celular; olvida los que ya no existen; una falla no se propaga', async () => {
    const send = vi.fn(async (s: StoredSubscription, _payload: string) => {
      if (s.endpoint.endsWith('/b')) return 'gone' as const;
      if (s.endpoint.endsWith('/c')) throw new Error('red caída');
      return 'sent' as const;
    });
    const { notifications, repo } = setup({ send });
    await expect(notifications.notifyUsers(['ana', 'beto'], MESSAGE)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(3);
    expect(JSON.parse(send.mock.calls[0]![1] as string)).toEqual(MESSAGE);
    expect(repo.forget).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/b');
    expect(repo.forget).toHaveBeenCalledTimes(1);
  });
});

describe('avisos de un menor a sus acudientes (2026-11-10)', () => {
  it('la convocatoria del niño le llega a su acudiente, con su nombre y su pantalla', async () => {
    const { notifications, repo, sender } = setup({});
    vi.mocked(repo.guardiansOf).mockResolvedValue([
      { minorId: 'nino', minorName: 'Sofía Ramírez', guardianId: 'mama' },
    ]);
    vi.mocked(repo.forUsers).mockImplementation(async (ids) =>
      ids.includes('mama') ? [sub('https://fcm.googleapis.com/fcm/send/mama')] : [],
    );
    await notifications.notifyUsers(['nino'], MESSAGE);
    expect(sender.send).toHaveBeenCalledTimes(1);
    const [target, payload] = vi.mocked(sender.send).mock.calls[0]!;
    expect(target.endpoint).toBe('https://fcm.googleapis.com/fcm/send/mama');
    expect(JSON.parse(payload)).toEqual({
      ...MESSAGE,
      child: 'Sofía',
      url: '/deportistas/nino/equipos/t/partidos/m',
    });
  });

  it('el recordatorio del test no le llega al acudiente', async () => {
    const { notifications, repo, sender } = setup({});
    vi.mocked(repo.guardiansOf).mockResolvedValue([
      { minorId: 'nino', minorName: 'Sofía', guardianId: 'mama' },
    ]);
    vi.mocked(repo.forUsers).mockImplementation(async (ids) =>
      ids.includes('mama') ? [sub('https://fcm.googleapis.com/fcm/send/mama')] : [],
    );
    await notifications.notifyUsers(['nino'], {
      kind: 'test-reminder',
      team: 'Sub-10',
      opponent: 'Sub-10',
      url: '/equipos/t/test',
    });
    expect(sender.send).not.toHaveBeenCalled();
  });
});

describe('guardianUrl', () => {
  it('lleva cada pantalla del jugador a la del niño', () => {
    expect(guardianUrl('/equipos/t/partidos/m', 'n')).toBe('/deportistas/n/equipos/t/partidos/m');
    expect(guardianUrl('/equipos/t/partidos', 'n')).toBe('/deportistas/n/equipos/t/partidos');
    expect(guardianUrl('/equipos/t/mis-cuentas', 'n')).toBe('/deportistas/n/equipos/t/cuentas');
    expect(guardianUrl('/equipos/t/tarjeta', 'n')).toBe('/deportistas/n');
  });
});

describe('solo a servicios de avisos conocidos (auditoría 2026-11-11)', () => {
  it('una suscripción guardada con otro host no recibe nada y se olvida', async () => {
    const { notifications, repo, sender } = setup({});
    vi.mocked(repo.forUsers).mockResolvedValue([
      sub('https://127.0.0.1:8443/x'),
      sub('https://interno.example/hook'),
      sub('https://fcm.googleapis.com/fcm/send/ok'),
    ]);
    await notifications.notifyUsers(['ana'], MESSAGE);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sender.send).mock.calls[0]![0].endpoint).toBe(
      'https://fcm.googleapis.com/fcm/send/ok',
    );
    expect(repo.forget).toHaveBeenCalledWith('https://127.0.0.1:8443/x');
    expect(repo.forget).toHaveBeenCalledWith('https://interno.example/hook');
  });
});
