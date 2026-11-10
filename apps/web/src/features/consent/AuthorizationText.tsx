import authorization from '../../../../../docs/legal/autorizacion-representante-legal.md?raw';
import { LegalText } from './LegalText';

/**
 * La autorización del representante legal (docs/legal/autorizacion-representante-legal.md,
 * `GUARDIAN_AUTHORIZATION_VERSION`), que acepta el acudiente al inscribir a su hijo.
 */
export function AuthorizationText() {
  return <LegalText markdown={authorization} />;
}
