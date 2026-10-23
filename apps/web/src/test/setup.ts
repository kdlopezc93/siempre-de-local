import '@testing-library/jest-dom/vitest';
// El inicio y el test leen la cola sin conexión (IndexedDB), que jsdom no trae.
import 'fake-indexeddb/auto';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'https://api.sdl.test');

afterEach(() => {
  cleanup();
});

// jsdom no implementa <dialog> modal (la hoja inferior lo usa): lo justo para abrir y cerrar.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
