/**
 * A dónde vuelve alguien después de entrar (`/entrar?volver=`): solo rutas de la misma app,
 * nunca otro sitio (`//otro.com`, `/\otro.com`, `https://…`). Si no sirve, el inicio.
 */
export function safeReturn(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/';
  return path;
}

/** "/entrar", o "/entrar?volver=…" si iba a otra pantalla. */
export function loginPath(returnTo: string): string {
  const path = safeReturn(returnTo);
  return path === '/' ? '/entrar' : `/entrar?volver=${encodeURIComponent(path)}`;
}
