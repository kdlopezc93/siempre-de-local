const KEY = 'sdl.updatedForPolicyAt';
/** Una vez por minuto, como mucho: si la versión nueva todavía no está publicada, no se recarga en bucle. */
const COOLDOWN_MS = 60_000;

/**
 * Trae la versión nueva de la app y recarga (2026-11-06). El service worker guarda la app: si el
 * servidor ya cambió la política y el celular sigue con la versión anterior, "Acepto" manda la
 * versión vieja una y otra vez. Pide al service worker que busque la nueva, espera a que tome el
 * control (unos segundos como mucho) y recarga. Devuelve false si ya lo intentó hace poco.
 */
export async function reloadWithLatestVersion(now = Date.now()): Promise<boolean> {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Sin sessionStorage (privado, bloqueado): se intenta igual.
  }
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  const registration = await sw?.getRegistration().catch(() => undefined);
  if (sw && registration) {
    const takesOver = new Promise<void>((resolve) => {
      sw.addEventListener('controllerchange', () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
    await registration.update().catch(() => {});
    if (registration.installing || registration.waiting) await takesOver;
  }
  window.location.reload();
  return true;
}
