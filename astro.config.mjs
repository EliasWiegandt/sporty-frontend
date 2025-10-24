import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import UnoCSS from 'unocss/astro';
import { webcore } from 'webcoreui/integration';

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
    UnoCSS({
      injectReset: false,
    }),
    webcore(),
  ],
});
