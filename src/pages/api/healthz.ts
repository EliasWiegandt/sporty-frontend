import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const reqId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();
  return new Response(JSON.stringify({ ok: true, request_id: reqId }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': reqId,
    },
  });
};
