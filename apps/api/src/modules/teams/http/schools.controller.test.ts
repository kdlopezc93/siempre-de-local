import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ClubCodePreviewResponseSchema,
  ClubResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  CreateTeamResponseSchema,
  ErrorBodySchema,
  MeResponseSchema,
  POLICY_VERSION,
  TeamResponseSchema,
} from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { user } from '../../identity/infrastructure/schema.js';

/** Escuelas (2026-11-07, 08 §10): club de tipo escuela, categorías con años y sedes. */
describe('escuelas: base (2026-11-07)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let admin: SeededUser, director: SeededUser, barrio: SeededUser;
  let schoolId: string, firstCategoryId: string, clubId: string, clubTeamId: string;

  const call = (
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    path: string,
    who: SeededUser,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(payload ? { payload } : {}),
    });
  const errorCode = (res: { json: () => unknown }) => ErrorBodySchema.parse(res.json()).error.code;
  const newCode = async (kind?: 'club' | 'school') =>
    CreateClubCodeResponseSchema.parse(
      (await call('POST', '/admin/club-codes', admin, kind ? { kind } : {})).json(),
    );
  const getClub = async (id: string, who = director) =>
    ClubResponseSchema.parse((await call('GET', `/clubs/${id}`, who)).json());

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    admin = await seedUserWithSession(url, { name: 'Kevin', email: 'kevin@example.com' });
    director = await seedUserWithSession(url, { name: 'Marta', email: 'marta@example.com' });
    barrio = await seedUserWithSession(url, { name: 'Pedro', email: 'pedro@example.com' });
    await connection.db.update(user).set({ platformAdmin: true }).where(eq(user.id, admin.userId));
    app = await bootApp(url);
    for (const who of [director, barrio]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
    // Un club de barrio, para ver que lo de escuelas no le aplica.
    const club = CreateClubResponseSchema.parse(
      (
        await call('POST', '/clubs', barrio, {
          code: (await newCode()).code,
          clubName: 'Los Tigres',
          city: 'Bosa',
          teamName: 'Tigres',
          format: 'F8',
          season: '2026',
        })
      ).json(),
    );
    clubId = club.clubId;
    clubTeamId = club.teamId;
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const schoolForm = (code: string, extra: object = {}) => ({
    code,
    clubName: 'Escuela Semillas',
    city: 'Kennedy',
    teamName: 'Sub-12 masculino',
    category: 'Sub-12',
    format: 'F8',
    season: '2026',
    birthYears: { from: 2014, to: 2015 },
    gender: 'male',
    ...extra,
  });

  it('el código dice si abre una escuela, en la lista y en la vista previa', async () => {
    const { clubCode, code } = await newCode('school');
    expect(clubCode.kind).toBe('school');
    const preview = await app.inject({ method: 'GET', url: `/api/v1/club-codes/${code}` });
    expect(ClubCodePreviewResponseSchema.parse(preview.json()).kind).toBe('school');
    expect((await newCode()).clubCode.kind).toBe('club');
  });

  it('la escuela pide los años de su primera categoría; el club de barrio no los acepta', async () => {
    const { code } = await newCode('school');
    const missing = await call(
      'POST',
      '/clubs',
      director,
      schoolForm(code, { birthYears: undefined }),
    );
    expect(missing.statusCode).toBe(422);
    expect(errorCode(missing)).toBe('BIRTH_YEARS_REQUIRED');
    const backwards = await call(
      'POST',
      '/clubs',
      director,
      schoolForm(code, { birthYears: { from: 2015, to: 2014 } }),
    );
    expect(backwards.statusCode).toBe(400);

    const club = await call('POST', '/clubs', director, {
      ...schoolForm((await newCode()).code),
      clubName: 'Otro',
    });
    expect(club.statusCode).toBe(422);
    expect(errorCode(club)).toBe('SCHOOL_ONLY');
  });

  it('crea la escuela con su primera categoría', async () => {
    const res = await call('POST', '/clubs', director, schoolForm((await newCode('school')).code));
    expect(res.statusCode).toBe(201);
    ({ clubId: schoolId, teamId: firstCategoryId } = CreateClubResponseSchema.parse(res.json()));

    const me = MeResponseSchema.parse((await call('GET', '/me', director)).json());
    expect(me.clubs).toEqual([
      { id: schoolId, name: 'Escuela Semillas', role: 'owner', kind: 'school' },
    ]);
    expect(me.teams.find((t) => t.team.id === firstCategoryId)?.club.kind).toBe('school');

    const team = TeamResponseSchema.parse(
      (await call('GET', `/teams/${firstCategoryId}`, director)).json(),
    );
    expect(team.team).toMatchObject({
      name: 'Sub-12 masculino',
      category: 'Sub-12',
      birthYears: { from: 2014, to: 2015 },
      gender: 'male',
      venue: null,
      club: { kind: 'school', sport: 'football' },
    });

    const school = await getClub(schoolId);
    expect(school.club).toMatchObject({ kind: 'school', sport: 'football' });
    expect(school.teamsLimit).toBe(30);
    expect(school.venues).toEqual([]);
    expect((await getClub(clubId, barrio)).teamsLimit).toBe(3);
  });

  it('sedes: el dueño las crea, cambia y borra; el nombre no se repite', async () => {
    const created = await call('POST', `/clubs/${schoolId}/venues`, director, {
      name: 'Parque El Tunal',
      address: 'Cancha 3',
    });
    expect(created.statusCode).toBe(201);
    const [tunal] = ClubResponseSchema.parse(created.json()).venues;
    expect(tunal).toMatchObject({ name: 'Parque El Tunal', address: 'Cancha 3', teams: 0 });

    const twice = await call('POST', `/clubs/${schoolId}/venues`, director, {
      name: 'Parque El Tunal',
    });
    expect(twice.statusCode).toBe(409);
    expect(errorCode(twice)).toBe('VENUE_NAME_TAKEN');

    const renamed = await call('PATCH', `/clubs/${schoolId}/venues/${tunal!.id}`, director, {
      name: 'El Tunal',
      address: '',
    });
    expect(ClubResponseSchema.parse(renamed.json()).venues[0]).toMatchObject({
      name: 'El Tunal',
      address: null,
    });

    const extra = ClubResponseSchema.parse(
      (await call('POST', `/clubs/${schoolId}/venues`, director, { name: 'Timiza' })).json(),
    ).venues.find((v) => v.name === 'Timiza')!;
    const removed = await call('DELETE', `/clubs/${schoolId}/venues/${extra.id}`, director);
    expect(ClubResponseSchema.parse(removed.json()).venues.map((v) => v.name)).toEqual([
      'El Tunal',
    ]);
    expect(
      (await call('DELETE', `/clubs/${schoolId}/venues/${extra.id}`, director)).statusCode,
    ).toBe(404);
  });

  it('sedes: solo en escuelas y solo su dueño o admins', async () => {
    const inClub = await call('POST', `/clubs/${clubId}/venues`, barrio, { name: 'La 68' });
    expect(inClub.statusCode).toBe(422);
    expect(errorCode(inClub)).toBe('SCHOOL_ONLY');
    expect(
      (await call('POST', `/clubs/${schoolId}/venues`, barrio, { name: 'La 68' })).statusCode,
    ).toBe(403);
  });

  it('otra categoría con sus años y su sede; la sede tiene que ser de la escuela', async () => {
    const [tunal] = (await getClub(schoolId)).venues;
    const res = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-10',
      category: 'Sub-10',
      format: 'F5',
      season: '2026',
      birthYears: { from: 2016, to: 2017 },
      gender: 'mixed',
      venueId: tunal!.id,
    });
    expect(res.statusCode).toBe(201);
    const { teamId } = CreateTeamResponseSchema.parse(res.json());
    const school = await getClub(schoolId);
    expect(school.teams.find((t) => t.id === teamId)).toMatchObject({
      birthYears: { from: 2016, to: 2017 },
      gender: 'mixed',
      venue: { id: tunal!.id, name: 'El Tunal' },
    });
    expect(school.venues[0]!.teams).toBe(1);

    const noCategory = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-8',
      format: 'F5',
      season: '2026',
      birthYears: { from: 2018, to: 2018 },
      gender: 'mixed',
    });
    expect(errorCode(noCategory)).toBe('CATEGORY_REQUIRED');

    const noYears = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-8',
      category: 'Sub-8',
      format: 'F5',
      season: '2026',
    });
    expect(errorCode(noYears)).toBe('BIRTH_YEARS_REQUIRED');

    const noGender = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-8',
      category: 'Sub-8',
      format: 'F5',
      season: '2026',
      birthYears: { from: 2018, to: 2018 },
    });
    expect(errorCode(noGender)).toBe('CATEGORY_GENDER_REQUIRED');

    // Un grupo más de Sub-12: los mismos años, otro nombre.
    const female = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-12 femenino',
      category: 'Sub-12',
      format: 'F8',
      season: '2026',
      birthYears: { from: 2014, to: 2015 },
      gender: 'female',
    });
    expect(female.statusCode).toBe(201);

    // Las categorías no se cruzan de años (2026-11-07).
    const group = (category: string, years: object, name = `${category} grupo`) =>
      call('POST', `/clubs/${schoolId}/teams`, director, {
        name,
        category,
        format: 'F8',
        season: '2026',
        birthYears: years,
        gender: 'mixed',
      });
    const overlap = await group('Sub-11', { from: 2015, to: 2016 });
    expect(overlap.statusCode).toBe(409);
    expect(errorCode(overlap)).toBe('CATEGORY_YEARS_OVERLAP');
    expect(ErrorBodySchema.parse(overlap.json()).error.message).toContain('Sub-12 (2014–2015)');
    expect(errorCode(await group('Sub-12', { from: 2014, to: 2014 }))).toBe(
      'CATEGORY_YEARS_MISMATCH',
    );
    expect(errorCode(await group('Infantil', { from: 2014, to: 2015 }))).toBe(
      'CATEGORY_NAME_MISMATCH',
    );
    // 18+: abierta por abajo.
    const adults = await group('Mayores', { from: null, to: 2008 }, 'Mayores masculino');
    expect(adults.statusCode).toBe(201);
    expect(errorCode(await group('Sub-20', { from: 2007, to: 2009 }))).toBe(
      'CATEGORY_YEARS_OVERLAP',
    );

    const otherVenue = await call('POST', `/clubs/${schoolId}/teams`, director, {
      name: 'Sub-8',
      category: 'Sub-8',
      format: 'F5',
      season: '2026',
      birthYears: { from: 2018, to: 2018 },
      gender: 'female',
      venueId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00',
    });
    expect(otherVenue.statusCode).toBe(404);
    expect(errorCode(otherVenue)).toBe('VENUE_NOT_FOUND');

    // Borrar la sede deja a la categoría sin sede.
    await call('DELETE', `/clubs/${schoolId}/venues/${tunal!.id}`, director);
    const team = TeamResponseSchema.parse((await call('GET', `/teams/${teamId}`, director)).json());
    expect(team.team.venue).toBeNull();
  });

  it('en Datos del equipo se cambian los años y la sede, solo en escuelas', async () => {
    const venue = (await getClub(schoolId)).venues;
    expect(venue).toEqual([]);
    const created = ClubResponseSchema.parse(
      (await call('POST', `/clubs/${schoolId}/venues`, director, { name: 'Castilla' })).json(),
    ).venues[0]!;
    // Sub-12 femenino sigue en 2014–2015: este grupo no se va solo a otros años.
    const split = await call('PATCH', `/teams/${firstCategoryId}`, director, {
      birthYears: { from: 2013, to: 2014 },
    });
    expect(errorCode(split)).toBe('CATEGORY_YEARS_MISMATCH');
    // Con otra categoría y años libres, sí.
    const res = await call('PATCH', `/teams/${firstCategoryId}`, director, {
      category: 'Sub-7',
      birthYears: { from: 2019, to: 2019 },
      gender: 'mixed',
      venueId: created.id,
    });
    expect(res.statusCode).toBe(200);
    expect(TeamResponseSchema.parse(res.json()).team).toMatchObject({
      category: 'Sub-7',
      birthYears: { from: 2019, to: 2019 },
      gender: 'mixed',
      venue: { id: created.id, name: 'Castilla' },
    });
    const cleared = await call('PATCH', `/teams/${firstCategoryId}`, director, { venueId: null });
    expect(TeamResponseSchema.parse(cleared.json()).team.venue).toBeNull();

    const inClub = await call('PATCH', `/teams/${clubTeamId}`, barrio, {
      birthYears: { from: 1990, to: 1995 },
    });
    expect(inClub.statusCode).toBe(422);
    expect(errorCode(inClub)).toBe('SCHOOL_ONLY');
    const genderInClub = await call('PATCH', `/teams/${clubTeamId}`, barrio, { gender: 'female' });
    expect(errorCode(genderInClub)).toBe('SCHOOL_ONLY');
  });
});
