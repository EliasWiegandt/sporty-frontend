import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

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
  integrations: [preact()],
});
