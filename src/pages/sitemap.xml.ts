import type { APIRoute } from 'astro';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const listResp = await fetch(new URL('/api/sport-bodies', request.url));
  const listPayload = listResp.ok ? await listResp.json() : { items: [] };
  const items = Array.isArray(listPayload?.items) ? listPayload.items : [];

  const urls = [
    `${origin}/sport-bodies`,
    ...items
      .map((item: any) => item?.canonical_path)
      .filter((path: any) => typeof path === 'string' && path.startsWith('/'))
      .map((path: string) => `${origin}${path}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`)
    .join('\n')}\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
