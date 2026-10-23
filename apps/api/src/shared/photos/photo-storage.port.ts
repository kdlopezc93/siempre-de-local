/**
 * Dónde viven las fotos (ADR-09, D15): fuera de la base, por clave. En local, el disco; en
 * staging y producción, Cloudflare R2. La base solo guarda la clave.
 */
export interface PhotoStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  /** Idempotente: borrar algo que no está no es un error. */
  delete(key: string): Promise<void>;
}

export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');
