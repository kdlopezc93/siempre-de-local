import { Module } from '@nestjs/common';

import { LinkPreviews } from './application/previews.use-case.js';
import { IMAGE_RENDERER, PREVIEWS_REPOSITORY } from './application/ports/previews.ports.js';
import { PreviewsController } from './http/previews.controller.js';
import { DrizzlePreviewsRepository } from './infrastructure/drizzle-previews.repository.js';
import { ResvgRenderer } from './infrastructure/resvg.renderer.js';

/** La vista previa de los enlaces en WhatsApp (2026-11-06, ADR-10). */
@Module({
  controllers: [PreviewsController],
  providers: [
    LinkPreviews,
    { provide: PREVIEWS_REPOSITORY, useClass: DrizzlePreviewsRepository },
    { provide: IMAGE_RENDERER, useClass: ResvgRenderer },
  ],
})
export class PreviewsModule {}
