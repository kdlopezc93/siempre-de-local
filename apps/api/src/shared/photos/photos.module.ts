import { Global, Module } from '@nestjs/common';

import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { DiskPhotoStorage } from './disk-photo-storage.js';
import { PHOTO_STORAGE } from './photo-storage.port.js';

/** El almacenamiento de fotos para todos los módulos (ADR-09). R2 llega con staging (D5). */
@Global()
@Module({
  providers: [
    {
      provide: PHOTO_STORAGE,
      useFactory: (env: Env) => new DiskPhotoStorage(env.PHOTOS_DIR),
      inject: [ENV],
    },
  ],
  exports: [PHOTO_STORAGE],
})
export class PhotosModule {}
