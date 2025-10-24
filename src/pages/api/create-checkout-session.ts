import type { APIRoute } from 'astro';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
} as const;

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

  const upstreamUrl = new URL('/create-checkout-session', backendUrl);
  const body = await request.text();

  try {
    const upstreamResp = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Request-Id': reqId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
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
    console.error('[Sporty] Upstream checkout request failed', error);
    return new Response(
      JSON.stringify({
        detail: 'Checkout unavailable. Please try again in a moment.',
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
