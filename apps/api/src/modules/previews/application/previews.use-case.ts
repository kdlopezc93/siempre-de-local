import { Inject, Injectable } from '@nestjs/common';
import type { LinkPreview } from '@sdl/contracts';

import { NotFoundError } from '../../../shared/errors/application-errors.js';
import { chargeCard, matchCard, previewSvg, type PreviewCard } from './preview-card.js';
import {
  IMAGE_RENDERER,
  type ImageRenderer,
  PREVIEWS_REPOSITORY,
  type PreviewsRepository,
} from './ports/previews.ports.js';

type Kind = 'matches' | 'charges';

/**
 * La vista previa de los enlaces de la app en WhatsApp (2026-11-06, nivel 2). Pública: la pide
 * el servidor de WhatsApp, sin sesión. Solo el equipo, el rival y la hora, o de qué es un cobro
 * (nunca cuánto); nunca nombres de jugadores. Quien no tiene el enlace no adivina el id (UUID).
 */
@Injectable()
export class LinkPreviews {
  constructor(
    @Inject(PREVIEWS_REPOSITORY) private readonly previews: PreviewsRepository,
    @Inject(IMAGE_RENDERER) private readonly renderer: ImageRenderer,
  ) {}

  async card(kind: Kind, id: string): Promise<PreviewCard> {
    if (kind === 'matches') {
      const match = await this.previews.match(id);
      if (match) return matchCard(match);
    } else {
      const charge = await this.previews.charge(id);
      if (charge) return chargeCard(charge);
    }
    throw new NotFoundError('No encontramos ese enlace');
  }

  async preview(kind: Kind, id: string): Promise<LinkPreview> {
    const card = await this.card(kind, id);
    return {
      title: card.title,
      description: card.description,
      image: `/api/v1/previews/${kind}/${id}/image.png`,
    };
  }

  async image(kind: Kind, id: string): Promise<Buffer> {
    return this.renderer.png(previewSvg(await this.card(kind, id)));
  }
}
