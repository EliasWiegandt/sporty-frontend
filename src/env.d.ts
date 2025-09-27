/// <reference types="astro/client" />

import type { Runtime } from '@astrojs/cloudflare';

export type Env = {
  RENDER_URL: string;
  RENDER_API_KEY: string;
  SUPABASE_URL?: string;
  SUPABASE_STORAGE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  STRIPE_PUBLIC_KEY?: string;
};

declare global {
  namespace App {
    interface Locals extends Runtime<Env> {}
  }
}
