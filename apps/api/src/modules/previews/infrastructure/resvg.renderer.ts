import { Injectable } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';

import type { ImageRenderer } from '../application/ports/previews.ports.js';

/** Las fuentes de la app (OFL, en apps/api/assets/fonts): estáticas, resvg no usa las variables. */
const FONTS = [
  'PlusJakartaSans-SemiBold.ttf',
  'PlusJakartaSans-Bold.ttf',
  'PlusJakartaSans-ExtraBold.ttf',
  'SpaceGrotesk-Bold.ttf',
].map((file) => fileURLToPath(new URL(`../../../../assets/fonts/${file}`, import.meta.url)));

@Injectable()
export class ResvgRenderer implements ImageRenderer {
  png(svg: string): Buffer {
    return new Resvg(svg, {
      font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Plus Jakarta Sans' },
    })
      .render()
      .asPng();
  }
}
