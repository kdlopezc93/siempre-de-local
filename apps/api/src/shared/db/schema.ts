/**
 * Punto de entrada del esquema para drizzle-kit. Cada módulo define sus tablas en su
 * `infrastructure/` y se reexportan aquí (docs/03-modelo-datos.md).
 */
export * from './enums.js';
export * from '../../modules/identity/infrastructure/consent.schema.js';
export * from '../../modules/identity/infrastructure/schema.js';
export * from '../../modules/questionnaires/infrastructure/schema.js';
export * from '../../modules/teams/infrastructure/schema.js';
export * from '../../modules/quiz/infrastructure/schema.js';
export * from '../../modules/player-profile/infrastructure/schema.js';
export * from '../../modules/assessments/infrastructure/schema.js';
export * from '../../modules/ratings/infrastructure/schema.js';
export * from '../../modules/audit/infrastructure/schema.js';
export * from '../../modules/certification/infrastructure/schema.js';
export * from '../../modules/lineups/infrastructure/schema.js';
export * from '../../modules/matches/infrastructure/schema.js';
