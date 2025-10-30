import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',

  adapter: cloudflare({
    imageService: 'astro/assets/services/noop',
  }),

  server: {
    host: true,
  },

  session: {
    driver: 'null',
  },

  integrations: [
    preact(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
