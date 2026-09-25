import type { Plugin } from 'vite';

async function proxyAnalyticsAction(
  analyticsBase: string,
  action: string,
  incoming: URL,
): Promise<{ status: number; text: string }> {
  const target = new URL(analyticsBase);
  target.searchParams.set('action', action);
  incoming.searchParams.forEach((value, key) => {
    if (key !== 'action') target.searchParams.set(key, value);
  });
  const upstream = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
  return { status: upstream.status, text: await upstream.text() };
}

/** Dev server proxy to analytics Lambda Brawl actions (Moxfield/Archidekt are server-only). */
export function brawlPopularityDevPlugin(): Plugin {
  return {
    name: 'brawl-popularity-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        const action =
          path === '/api/brawl-popularity'
            ? 'brawl-popularity'
            : path === '/api/brawl-top-commanders'
              ? 'brawl-top-commanders'
              : null;
        if (!action) {
          next();
          return;
        }
        const analyticsBase = process.env.VITE_ANALYTICS_URL;
        if (!analyticsBase) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              source: 'scryfall',
              status: 503,
              limitedData: true,
              names: [],
            }),
          );
          return;
        }
        try {
          const incoming = new URL(req.url ?? '/', 'http://localhost');
          const { status, text } = await proxyAnalyticsAction(analyticsBase, action, incoming);
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (err) {
          console.error('[brawl-analytics-dev]', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ source: 'scryfall', status: 502, limitedData: true, names: [] }));
        }
      });
    },
  };
}
