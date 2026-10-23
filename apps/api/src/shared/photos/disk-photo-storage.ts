import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import type { PhotoStorage } from './photo-storage.port.js';

const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg' };

/** Fotos en una carpeta del disco: para desarrollo y tests. */
export class DiskPhotoStorage implements PhotoStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** La clave la arma el API, pero igual nunca sale de la carpeta. */
  private path(key: string) {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error(`Clave de foto inválida: ${key}`);
    return full;
  }

  async put(key: string, bytes: Buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string) {
    try {
      const bytes = await readFile(this.path(key));
      return {
        bytes,
        contentType: TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream',
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}
