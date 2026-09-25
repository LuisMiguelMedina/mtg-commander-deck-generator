import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type SnapshotFile = {
  topCommanders?: { source?: string; names?: string[]; limitedData?: boolean };
  popularityByCommander?: Record<
    string,
    { source?: string; numDecks?: number; cards?: unknown[]; limitedData?: boolean }
  >;
};

function loadSnapshotFile(root: string): SnapshotFile | null {
  try {
    const raw = readFileSync(join(root, 'public/data/brawl-community-snapshot.json'), 'utf8');
    return JSON.parse(raw) as SnapshotFile;
  } catch {
    return null;
  }
}

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

function respondFromSnapshot(
  action: string,
  incoming: URL,
  snapshot: SnapshotFile | null,
): { status: number; body: unknown } | null {
  if (!snapshot) return null;
  if (action === 'brawl-top-commanders') {
    const names = snapshot.topCommanders?.names ?? [];
    if (!names.length) return null;
    return {
      status: 200,
      body: {
        source: snapshot.topCommanders?.source === 'moxfield' ? 'moxfield' : 'archidekt',
        status: 200,
        names,
        limitedData: snapshot.topCommanders?.limitedData ?? true,
      },
    };
  }
  const commanderName = incoming.searchParams.get('commanderName')?.trim();
  if (!commanderName) {
    return { status: 400, body: { error: 'commanderName required' } };
  }
  const key = commanderName.toLowerCase();
  const entry =
    snapshot.popularityByCommander?.[key] ?? snapshot.popularityByCommander?.[commanderName];
  if (!entry?.cards?.length || !entry.numDecks) return null;
  return {
    status: 200,
    body: {
      source: entry.source === 'moxfield' ? 'moxfield' : 'archidekt',
      status: 200,
      numDecks: entry.numDecks,
      cards: entry.cards,
      limitedData: entry.limitedData ?? entry.numDecks < 5,
    },
  };
}

/** Dev server proxy to analytics Lambda Brawl actions (Moxfield/Archidekt are server-only). */
export function brawlPopularityDevPlugin(): Plugin {
  let projectRoot = process.cwd();
  return {
    name: 'brawl-popularity-dev',
    configResolved(config) {
      projectRoot = config.root;
    },
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
        try {
          const incoming = new URL(req.url ?? '/', 'http://localhost');
          if (analyticsBase) {
            const { status, text } = await proxyAnalyticsAction(analyticsBase, action, incoming);
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(text);
            return;
          }
          const snapshot = loadSnapshotFile(projectRoot);
          const local = respondFromSnapshot(action, incoming, snapshot);
          if (local) {
            res.statusCode = local.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(local.body));
            return;
          }
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
