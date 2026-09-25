import type { Plugin } from 'vite';

/** Dev server proxy to the analytics Lambda `brawl-popularity` action (no app imports — safe for vite config). */
export function brawlPopularityDevPlugin(): Plugin {
  return {
    name: 'brawl-popularity-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/brawl-popularity')) {
          next();
          return;
        }
        const analyticsBase = process.env.VITE_ANALYTICS_URL;
        if (!analyticsBase) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ source: 'scryfall', status: 503, limitedData: true }));
          return;
        }
        try {
          const incoming = new URL(req.url, 'http://localhost');
          const commanderName = incoming.searchParams.get('commanderName')?.trim();
          if (!commanderName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'commanderName required' }));
            return;
          }
          const target = new URL(analyticsBase);
          target.searchParams.set('action', 'brawl-popularity');
          target.searchParams.set('commanderName', commanderName);
          const upstream = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (err) {
          console.error('[brawl-popularity-dev]', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ source: 'scryfall', status: 502, limitedData: true }));
        }
      });
    },
  };
}
