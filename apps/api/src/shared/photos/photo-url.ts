/**
 * La URL de una foto para el cliente, o null. Lleva una versión (el final de la clave, que
 * cambia con cada foto nueva) para que el navegador no muestre la anterior.
 */
export function photoUrl(path: string, key: string | null): string | null {
  if (!key) return null;
  const version = key.split('/').pop()!.split('.')[0]!;
  return `/api/v1/${path}?v=${version}`;
}
