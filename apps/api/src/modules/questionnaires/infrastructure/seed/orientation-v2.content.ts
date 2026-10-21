import type { OrientationContent } from '../../application/orientation-content.js';
import { ORIENTATION_V1 } from './orientation-v1.content.js';

/**
 * v2 (2026-10-21): solo posición. Las mismas 31 preguntas del prototipo, 20 por intento para
 * un podio más estable, y sin las 8 de preparación (02 §5): el conocimiento de la posición
 * se mide con el examen de certificación.
 */
export const ORIENTATION_V2: OrientationContent = {
  label: 'v2',
  positionItemsPerAttempt: 20,
  positionItems: ORIENTATION_V1.positionItems,
  prepItems: {},
};
