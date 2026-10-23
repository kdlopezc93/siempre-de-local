import { describe, expect, it, vi } from 'vitest';

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
    forUsers: vi.fn(async () => [
      sub('https://push/a'),
      sub('https://push/b'),
      sub('https://push/c'),
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
    expect(repo.forget).toHaveBeenCalledWith('https://push/b');
    expect(repo.forget).toHaveBeenCalledTimes(1);
  });
});
