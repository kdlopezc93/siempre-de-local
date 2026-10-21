import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Paquetes que el dominio nunca puede importar (CLAUDE.md · Reglas de código). */
const FORBIDDEN_IN_DOMAIN = [
  '@nestjs/*',
  'drizzle-orm',
  'drizzle-orm/*',
  'pg',
  'better-auth',
  'better-auth/*',
  'react',
  'react-dom',
  'react/*',
  'fastify',
  'node:*',
];

/** Solo identity/infrastructure habla con Better Auth (ADR-07). */
const BETTER_AUTH = {
  group: ['better-auth', 'better-auth/*'],
  message: 'Solo apps/api/src/modules/identity/infrastructure puede importar Better Auth (ADR-07).',
};

/** El bloque de domain va después: en flat config la última regla gana. */
export const config = defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'docs/prototipo/**',
      '.agents/**',
      'apps/api/drizzle/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Nest inyecta por metadatos: los imports de clases usadas en constructores
    // deben quedar como valores, no como `import type`.
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: ['apps/api/src/modules/identity/infrastructure/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [BETTER_AUTH] }],
    },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FORBIDDEN_IN_DOMAIN,
              message: 'packages/domain es TS puro: sin frameworks ni I/O.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);

export default config;
