import type { APIRoute } from 'astro';
import { verifySupabaseToken } from './_auth';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
} as const;
const CHILD_FORECAST_UPSTREAM_TIMEOUT_MS = 30_000;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const reqId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();

  const backendUrl = env.RENDER_URL;
  const apiKey = env.RENDER_API_KEY;

  if (!backendUrl) {
    return new Response(
      JSON.stringify({ detail: 'Server not configured: missing RENDER_URL' }),
      {
        status: 500,
        headers: {
          ...JSON_HEADERS,
          'X-Request-Id': reqId,
        },
      }
    );
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({ detail: 'Server not configured: missing API key' }),
      {
        status: 500,
        headers: {
          ...JSON_HEADERS,
          'X-Request-Id': reqId,
        },
      }
    );
  }

  const user = await verifySupabaseToken(request, env);
  if (!user) {
    return new Response(
      JSON.stringify({
        detail: {
          code: 'CONSENT_REQUIRED',
          message: 'Sign in and grant consent before running analysis.',
        },
      }),
      {
        status: 403,
        headers: {
          ...JSON_HEADERS,
          'X-Request-Id': reqId,
        },
      }
    );
  }

  const upstreamUrl = new URL('/v1/forecast-child', backendUrl);
  const body = await request.text();

  try {
    const upstreamResp = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Request-Id': reqId,
        'X-User-ID': user.id,
      },
      body,
      signal: AbortSignal.timeout(CHILD_FORECAST_UPSTREAM_TIMEOUT_MS),
    });

    const text = await upstreamResp.text();
    const contentType =
      upstreamResp.headers.get('Content-Type') ?? 'application/json';

    return new Response(text, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': contentType,
        'X-Request-Id': reqId,
      },
    });
  } catch (error) {
    console.error('[Sporty] Upstream child forecast request failed', error);
    return new Response(
      JSON.stringify({
        detail: 'Upstream unavailable. Please try again in a moment.',
        request_id: reqId,
      }),
      {
        status: 502,
        headers: {
          ...JSON_HEADERS,
          'X-Request-Id': reqId,
        },
      }
    );
  }
};
