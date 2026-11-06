import type { Match, MatchRoster } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { callUpMessage, lineupMessage, namesList } from './share-messages';

const match = (over: Partial<Match> = {}) =>
  ({
    kind: 'friendly',
    opponent: 'Real Bosa',
    tournament: null,
    startsAt: '2026-11-08T20:00:00.000Z',
    place: 'Cancha El Tunal',
    replies: { yes: 9, no: 2, pending: 3, injured: 1 },
    ...over,
  }) as Match;

const person = (displayName: string, over: Partial<MatchRoster[number]> = {}) => ({
  playerId: displayName,
  displayName,
  jerseyNumber: null,
  reply: null,
  canRate: true,
  injured: false,
  came: false,
  ...over,
});

describe('mandar al grupo (2026-11-06)', () => {
  it('nombra a los que faltan por responder, sin los lesionados ni los que respondieron', () => {
    const roster = [
      person('Juan'),
      person('Pipe'),
      person('Ana', { reply: 'yes' }),
      person('Beto', { injured: true }),
      person('Ciro'),
    ];
    const text = callUpMessage(match(), roster, 'https://app/x');
    expect(text.split('\n')).toEqual([
      '⚽ *Amistoso vs Real Bosa*',
      expect.stringMatching(/^[A-Z].* · Cancha El Tunal$/),
      'Van 9 · No van 2',
      'Faltan por responder: Juan, Pipe y Ciro',
      'Responde acá 👉 https://app/x',
    ]);
  });

  it('cuando todos respondieron, lo dice; el entreno no tiene rival; el torneo va entre paréntesis', () => {
    expect(callUpMessage(match(), [person('Ana', { reply: 'yes' })], 'u')).toContain(
      'Ya respondieron todos',
    );
    expect(callUpMessage(match({ kind: 'training', opponent: null }), [], 'u')).toMatch(
      /^🏃 \*Entreno\*/,
    );
    expect(
      callUpMessage(
        match({ kind: 'championship', tournament: { id: 't', name: 'Liga del barrio' } }),
        [],
        'u',
      ),
    ).toMatch(/^⚽ \*Campeonato vs Real Bosa\* \(Liga del barrio\)/);
  });

  it('la alineación: el día y el rival, con el enlace', () => {
    const text = lineupMessage(match(), 'https://app/x');
    expect(text).toMatch(/^📋 \*Ya está la alineación para el .+ vs Real Bosa\*\n/);
    expect(text).toMatch(/Mira dónde juegas 👉 https:\/\/app\/x$/);
  });

  it('une los nombres como se habla', () => {
    expect(namesList([])).toBe('');
    expect(namesList(['Juan'])).toBe('Juan');
    expect(namesList(['Juan', 'Pipe', 'Ciro'])).toBe('Juan, Pipe y Ciro');
  });
});
