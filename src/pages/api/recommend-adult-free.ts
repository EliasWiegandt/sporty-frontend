import type { APIRoute } from 'astro';
import { verifySupabaseToken } from './_auth';

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

  const user = await verifySupabaseToken(request, env);

  const upstreamUrl = new URL('/v1/recommend-adult-free', backendUrl);
  const body = await request.text();
  const contentLength = body ? `${new TextEncoder().encode(body).length}` : "0";

  console.log(
    `[worker] recommend-adult-free body bytes=${contentLength} content-type=${
      request.headers.get("content-type") ?? "<missing>"
    }`
  );
  if (!body || body.trim().length === 0) {
    return new Response(
      JSON.stringify({
        detail:
          "Request body is missing. The client should POST the intake JSON payload.",
      }),
      {
        status: 400,
        headers: {
          ...JSON_HEADERS,
          "X-Request-Id": reqId,
        },
      }
    );
  }

  const sessionId = request.headers.get('X-Session-ID');

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': contentLength,
    'X-API-Key': apiKey,
    'X-Request-Id': reqId,
  };
  if (sessionId) upstreamHeaders['X-Session-ID'] = sessionId;
  if (user?.id) upstreamHeaders['X-User-ID'] = user.id;

  try {
    const upstreamResp = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: upstreamHeaders,
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
    console.error('[Sporty] Upstream request failed', error);
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
