import { defineConfig } from 'vitest/config';

// Los paquetes del workspace se resuelven a su código fuente (src/*.ts), no a dist/.
const conditions = ['@sdl/source'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: conditions } },
  test: {
    setupFiles: ['reflect-metadata'],
    // Levantar un contenedor de Postgres tarda más que el timeout por defecto.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
