import type { APIRoute } from 'astro';
import { verifySupabaseToken } from '../_auth';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const reqId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const backendUrl = env.RENDER_URL;
  const apiKey = env.RENDER_API_KEY;

  if (!backendUrl || !apiKey) {
    return new Response(JSON.stringify({ detail: 'Server not configured.' }), {
      status: 500,
      headers: { ...JSON_HEADERS, 'X-Request-Id': reqId },
    });
  }

  const user = await verifySupabaseToken(request, env);
  if (!user) {
    return new Response(JSON.stringify({ detail: 'Unauthorized' }), {
      status: 401,
      headers: { ...JSON_HEADERS, 'X-Request-Id': reqId },
    });
  }

  const upstream = new URL('/v1/intake-prefill', backendUrl);
  try {
    const upstreamResp = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Request-Id': reqId,
        'X-User-ID': user.id,
      },
      signal: AbortSignal.timeout(10_000),
    });

    const text = await upstreamResp.text();
    return new Response(text, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': upstreamResp.headers.get('Content-Type') ?? 'application/json',
        'X-Request-Id': reqId,
      },
    });
  } catch (error) {
    console.error('[Sporty] Upstream intake prefill request failed', error);
    return new Response(JSON.stringify({ detail: 'Upstream unavailable.', request_id: reqId }), {
      status: 502,
      headers: { ...JSON_HEADERS, 'X-Request-Id': reqId },
    });
  }
};
