import policy from '../../../../../docs/legal/politica-tratamiento-datos.md?raw';
import { LegalText } from './LegalText';

/** Texto completo de la política vigente (docs/legal/politica-tratamiento-datos.md). */
export function PolicyText() {
  return <LegalText markdown={policy} />;
}
