import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

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
});
