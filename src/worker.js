// src/worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const reqId = request.headers.get("X-Request-Id") || crypto.randomUUID();

    // Proxy: POST /api/recommend-adult-free -> backend /recommend-adult-free
    if (
      request.method === "POST" &&
      url.pathname === "/api/recommend-adult-free"
    ) {
      const body = await request.text();

      const backendUrl = env.RENDER_URL;
      const apiKey = env.RENDER_API_KEY;

      // Check backend URL first
      if (!backendUrl) {
        return new Response(
          JSON.stringify({
            detail: "Server not configured: missing RENDER_URL",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": reqId,
            },
          }
        );
      }

      // Then check API key
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            detail: "Server not configured: missing API key",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": reqId,
            },
          }
        );
      }

      const upstream = new URL("/recommend-adult-free", backendUrl);
      try {
        const resp = await fetch(upstream.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-Request-Id": reqId,
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout for cold starts
        });

        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type":
              resp.headers.get("Content-Type") || "application/json",
            "X-Request-Id": reqId,
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            detail: "Upstream unavailable. Please try again in a moment.",
            request_id: reqId,
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": reqId,
            },
          }
        );
      }
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/api/healthz") {
      return new Response(JSON.stringify({ ok: true, request_id: reqId }), {
        headers: { "Content-Type": "application/json", "X-Request-Id": reqId },
      });
    }

    // Serve static assets from /site (see wrangler.toml `assets` binding)
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }

    return new Response("Not found", { status: 404 });
  },
};
