import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ locals, request }) => {
  const reqId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const env = locals.runtime.env;

  const config = {
    SUPABASE_STORAGE_URL: env.SUPABASE_STORAGE_URL ?? '',
    SUPABASE_URL: env.SUPABASE_URL ?? '',
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY ?? '',
    STRIPE_PUBLIC_KEY: env.STRIPE_PUBLIC_KEY ?? '',
  };

  const body = `self.SPORTY_CONFIG = ${JSON.stringify(config)};\n` +
    'self.SUPABASE_STORAGE_URL = self.SPORTY_CONFIG.SUPABASE_STORAGE_URL;\n' +
    'self.SUPABASE_URL = self.SPORTY_CONFIG.SUPABASE_URL;\n' +
    'self.SUPABASE_PUBLISHABLE_KEY = self.SPORTY_CONFIG.SUPABASE_PUBLISHABLE_KEY;\n' +
    'self.STRIPE_PUBLIC_KEY = self.SPORTY_CONFIG.STRIPE_PUBLIC_KEY;';

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': reqId,
    },
  });
};
