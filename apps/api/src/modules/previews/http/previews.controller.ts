import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { LinkPreview } from '@sdl/contracts';
import { z } from 'zod';

import { Public } from '../../../shared/authz/public.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import { LinkPreviews } from '../application/previews.use-case.js';

const Kind = z.enum(['matches', 'charges']);

/**
 * La vista previa de los enlaces en WhatsApp (2026-11-06, nivel 2): la pide la función de
 * Cloudflare Pages cuando quien abre el enlace es un bot de vistas previas. Pública y con tope.
 */
@Controller('previews')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 120 } })
export class PreviewsController {
  constructor(private readonly previews: LinkPreviews) {}

  @Public()
  @Get(':kind/:id')
  @Header('Cache-Control', 'public, max-age=300')
  preview(@Param('kind') kind: string, @Param('id') id: string): Promise<LinkPreview> {
    return this.previews.preview(parseInput(Kind, kind), parseInput(z.uuid(), id));
  }

  @Public()
  @Get(':kind/:id/image.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=300')
  image(@Param('kind') kind: string, @Param('id') id: string): Promise<Buffer> {
    return this.previews.image(parseInput(Kind, kind), parseInput(z.uuid(), id));
  }
}
