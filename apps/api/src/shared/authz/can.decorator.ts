import { SetMetadata } from '@nestjs/common';

import type { TeamPermission } from './policy.js';

export const REQUIRED_PERMISSION = 'sdl:requiredPermission';

export interface RequiredPermission {
  permission: TeamPermission;
  /** Nombre del parámetro de ruta con el id del equipo. */
  teamParam: string;
}

/** Primera barrera de autorización (04 §2.3); el caso de uso vuelve a decidir. */
export const Can = (permission: TeamPermission, options: { teamParam: string }) =>
  SetMetadata(REQUIRED_PERMISSION, { permission, teamParam: options.teamParam });
