// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://zerovoids.art',
  trailingSlash: 'always',
  integrations: [react()],
  vite: {
    server: {
      watch: {
        // Only ignore the repo-root constellations dir (venv/source/preview/debug),
        // NOT src/data/constellations which contains generated JSON we want to HMR.
        ignored: ['**/constellations/.venv/**', '**/constellations/source/**', '**/constellations/preview/**', '**/constellations/debug/**'],
      },
    },
  },
});