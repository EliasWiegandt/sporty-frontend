import type { APIRoute } from 'astro';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
} as const;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const reqId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const backendUrl = env.RENDER_URL;
  const apiKey = env.RENDER_API_KEY;
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ detail: 'user_id is required' }),
      {
        status: 400,
        headers: {
          ...JSON_HEADERS,
          'X-Request-Id': reqId,
        },
      }
    );
  }

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

  const upstreamUrl = new URL('/v1/credits', backendUrl);
  upstreamUrl.searchParams.set('user_id', userId);

  try {
    const upstreamResp = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'X-Request-Id': reqId,
      },
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
    console.error('[Sporty] Upstream credits request failed', error);
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
