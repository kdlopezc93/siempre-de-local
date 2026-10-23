import { readFileSync } from 'node:fs';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { E2E } from '../env.js';
import { FIXTURES } from '../global-setup.js';

interface Fixtures {
  teamId: string;
  coach: { name: string; value: string };
  player: { name: string; value: string };
}

const fixtures = (): Fixtures => JSON.parse(readFileSync(FIXTURES, 'utf8')) as Fixtures;

/** Entra "con Google" sin Google: la sesión ya está en la base, solo falta la cookie. */
async function signIn(context: BrowserContext, cookie: Fixtures['coach']) {
  await context.addCookies([
    { ...cookie, domain: `.${E2E.cookieDomain}`, path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
}

test.describe.configure({ mode: 'serial' });

let joinPath: string;

test('el entrenador crea un enlace de invitación', async ({ page, context }) => {
  const { teamId, coach } = fixtures();
  await signIn(context, coach);

  await page.goto('/');
  // La barra de abajo: Equipo → Invitar jugadores.
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Equipo' })
    .click();
  await page.getByRole('link', { name: 'Invitar jugadores' }).click();
  await expect(page).toHaveURL(`/equipos/${teamId}/invitar`);

  await page.getByRole('button', { name: 'Crear enlace' }).click();
  await expect(page.getByRole('heading', { name: 'Tu enlace está listo' })).toBeFocused();

  const joinUrl = await page.getByText(/\/unirse\/[2-9A-Z]{10}$/).textContent();
  joinPath = new URL(joinUrl!).pathname;
  await expect(page.getByText('0 de 30 personas')).toBeVisible();
});

test('un jugador nuevo se une, acepta la política y hace su test', async ({ page, context }) => {
  await signIn(context, fixtures().player);

  // La convocatoria.
  await page.goto(joinPath);
  await expect(page.getByText('Los del Barrio te convoca a')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Primer equipo' })).toBeVisible();
  await page.getByRole('button', { name: 'Unirme al equipo' }).click();

  // La política: sin la mayoría de edad no avanza.
  await expect(page.getByRole('heading', { name: 'Antes de unirte' })).toBeVisible();
  await page.getByRole('button', { name: 'Acepto y me uno' }).click();
  await expect(page.getByText(/solo para mayores de edad/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Tengo 18 años o más' }).check();
  await page.getByRole('button', { name: 'Acepto y me uno' }).click();

  await expect(page.getByRole('heading', { name: 'Ya estás en el equipo' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a mi equipo' }).click();

  // En el inicio, lo primero es hacer el test: 20 preguntas.
  await page.getByRole('link', { name: /Haz tu test de posición/ }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await answerAll(page);

  // El resultado oficial, calculado por el servidor.
  await expect(page.getByText('Tus 3 posiciones')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /Cancha con tus posiciones marcadas/ })).toBeVisible();
  await expect(page.getByRole('list').first().getByRole('listitem')).toHaveCount(3);

  // Y queda en Mi juego: su podio, que lleva al resultado.
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Mi juego' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Tus 3 posiciones' }).getByRole('listitem'),
  ).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Repetir el test' })).toBeVisible();
});

async function answerAll(page: Page) {
  for (let i = 1; i <= 20; i++) {
    await expect(page.getByText(`${i} de 20`)).toBeVisible();
    await page.getByRole('button', { pressed: false }).first().click();
  }
}
