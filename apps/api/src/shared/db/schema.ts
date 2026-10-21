/**
 * Punto de entrada del esquema para drizzle-kit. Cada módulo define sus tablas en su
 * `infrastructure/` y se reexportan aquí (docs/03-modelo-datos.md).
 */
export * from './enums.js';
export * from '../../modules/identity/infrastructure/schema.js';
export * from '../../modules/questionnaires/infrastructure/schema.js';
