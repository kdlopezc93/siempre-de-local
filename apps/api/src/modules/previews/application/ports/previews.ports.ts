import type { ChargeKind, MatchKind } from '@sdl/contracts';

export interface MatchForPreview {
  team: string;
  kind: MatchKind;
  opponent: string | null;
  tournament: string | null;
  startsAt: Date;
  cancelled: boolean;
}

export interface ChargeForPreview {
  team: string;
  kind: ChargeKind;
  title: string | null;
  match: { opponent: string | null; startsAt: Date } | null;
  tournament: string | null;
  cancelled: boolean;
}

/** Lo poco que necesita la vista previa (lo implementa su infraestructura). */
export interface PreviewsRepository {
  match(matchId: string): Promise<MatchForPreview | null>;
  charge(chargeId: string): Promise<ChargeForPreview | null>;
}
export const PREVIEWS_REPOSITORY = Symbol('PREVIEWS_REPOSITORY');

/** SVG → PNG (lo implementa resvg, con las fuentes de la app). */
export interface ImageRenderer {
  png(svg: string): Buffer;
}
export const IMAGE_RENDERER = Symbol('IMAGE_RENDERER');
