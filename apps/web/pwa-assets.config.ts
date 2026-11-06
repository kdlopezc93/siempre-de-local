import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#3155e8' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#3155e8' } },
  },
  // El de pruebas (túnel y local) lleva una franja "PRUEBAS" (2026-11-06): sus íconos salen en
  // public/pruebas/.
  images: ['public/favicon.svg', 'public/pruebas/favicon.svg'],
});
