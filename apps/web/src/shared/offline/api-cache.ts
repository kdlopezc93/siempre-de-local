/**
 * Caché del service worker para respuestas del API que deben verse sin conexión
 * (sesión y cuestionario). El nombre lo comparte vite.config.ts.
 */
export const API_CACHE_NAME = 'sdl-api';

/** Al cerrar sesión no deben quedar datos del usuario disponibles offline. */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(API_CACHE_NAME);
}
