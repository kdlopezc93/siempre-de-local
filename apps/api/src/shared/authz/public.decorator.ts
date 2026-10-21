import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'sdl:isPublic';

/** Marca una ruta como accesible sin sesión (04 §2.3). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
