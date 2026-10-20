import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@sdl/source'] },
  test: {
    // Levantar un contenedor de Postgres tarda más que el timeout por defecto.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
