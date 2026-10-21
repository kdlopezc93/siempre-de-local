import { BadRequestException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';

import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { SpikeAttempts } from '../application/spike-attempts.service.js';
import { SPIKE_QUESTIONNAIRE_ETAG } from '../application/spike-questionnaire.js';
import { SpikePwaController } from './spike-pwa.controller.js';

function fakeReply() {
  const state = { status: 200, headers: {} as Record<string, string> };
  const reply = {
    status(code: number) {
      state.status = code;
      return reply;
    },
    header(name: string, value: string) {
      state.headers[name] = value;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, state };
}

function sessionOf(userId: string): AuthSession {
  return {
    sessionId: 's',
    expiresAt: new Date(),
    user: { id: userId, name: 'Kevin', email: 'k@example.com', platformAdmin: false },
  };
}

const ATTEMPT = {
  clientAttemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  questionnaireVersion: 'spike-1',
  submittedAt: '2026-10-21T10:00:00.000Z',
  answers: [{ questionId: 'q1', optionId: 'a' }],
};

describe('spike PWA', () => {
  const controller = new SpikePwaController(new SpikeAttempts());

  it('sirve el cuestionario con ETag y lo revalida con 304', () => {
    const first = fakeReply();
    expect(controller.questionnaire(undefined, first.reply)?.questions).toHaveLength(3);
    expect(first.state.headers.etag).toBe(SPIKE_QUESTIONNAIRE_ETAG);
    expect(first.state.headers['cache-control']).toBe('private, no-cache');

    const again = fakeReply();
    expect(controller.questionnaire(SPIKE_QUESTIONNAIRE_ETAG, again.reply)).toBeUndefined();
    expect(again.state.status).toBe(304);
  });

  it('un reenvío del mismo intento devuelve el mismo resultado con 200', () => {
    const first = fakeReply();
    const created = controller.submit(sessionOf('u1'), ATTEMPT, first.reply);
    expect(first.state.status).toBe(201);
    expect(created.answerCount).toBe(1);

    const retry = fakeReply();
    expect(controller.submit(sessionOf('u1'), ATTEMPT, retry.reply)).toEqual(created);
    expect(retry.state.status).toBe(200);
  });

  it('el mismo clientAttemptId de otro usuario es un intento distinto', () => {
    const reply = fakeReply();
    controller.submit(sessionOf('u2'), ATTEMPT, reply.reply);
    expect(reply.state.status).toBe(201);
  });

  it('rechaza un cuerpo inválido', () => {
    expect(() =>
      controller.submit(sessionOf('u1'), { ...ATTEMPT, answers: [] }, fakeReply().reply),
    ).toThrow(BadRequestException);
  });
});
