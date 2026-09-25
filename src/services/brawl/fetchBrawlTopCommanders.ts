import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import {
  MOXFIELD_SEARCH_URL,
  MOXFIELD_TIMEOUT_MS,
  MOXFIELD_USER_AGENT,
} from '@/services/moxfield/client';
import { commanderNamesFromDeckDetail, isBrawlDeckSize } from '@/services/brawl/archidektBrawl100';
import { fetchAnalyticsAction, buildAnalyticsActionUrl } from '@/services/brawl/brawlAnalyticsProxy';

export type BrawlTopCommandersResponse = {
  source: 'moxfield' | 'archidekt' | 'scryfall';
  status: number;
  names: string[];
  limitedData?: boolean;
};

type MoxfieldDeckRow = {
  commanders?: Array<{ card?: { name?: string } }>;
  commanderName?: string;
};

const USER_AGENT = MOXFIELD_USER_AGENT;
const ARCHIDEKT_LIST = 'https://archidekt.com/api/decks/v3/';
const ARCHIDEKT_DECK = 'https://archidekt.com/api/decks';

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MOXFIELD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function moxfieldTopCommanders(): Promise<BrawlTopCommandersResponse> {
  const params = new URLSearchParams({
    fmt: MOXFIELD_BRAWL100_FMT,
    pageSize: '24',
    pageNumber: '1',
  });
  try {
    const response = await fetch(`${MOXFIELD_SEARCH_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(MOXFIELD_TIMEOUT_MS),
    });
    const status = response.status;
    if (!response.ok) {
      return { source: 'scryfall', status, names: [] };
    }
    const body = (await response.json()) as { data?: MoxfieldDeckRow[] };
    const names: string[] = [];
    for (const deck of body.data ?? []) {
      const name = deck.commanders?.[0]?.card?.name ?? deck.commanderName;
      if (name) names.push(name);
    }
    const unique = [...new Set(names)];
    if (unique.length === 0) {
      return { source: 'scryfall', status: 200, names: [], limitedData: true };
    }
    return { source: 'moxfield', status: 200, names: unique };
  } catch {
    return { source: 'scryfall', status: 503, names: [] };
  }
}

type DeckListRow = { id: number; size?: number };
type DeckListResponse = { results?: DeckListRow[] };
type DeckDetail = {
  size?: number;
  cards?: Array<{
    categories?: Array<string | { name?: string }>;
    card?: { oracleCard?: { name?: string } };
    quantity?: number;
  }>;
};

async function archidektTopCommanders(limit = 24): Promise<BrawlTopCommandersResponse> {
  const params = new URLSearchParams({
    deckFormat: '13',
    pageSize: '40',
    orderBy: '-updatedAt',
  });
  const list = await fetchJson<DeckListResponse>(`${ARCHIDEKT_LIST}?${params.toString()}`);
  if (!list?.results?.length) {
    return { source: 'scryfall', status: 502, names: [] };
  }

  const names: string[] = [];
  const seen = new Set<string>();
  const ids = list.results.map((r) => r.id).slice(0, 36);
  const batchSize = 6;

  for (let i = 0; i < ids.length && names.length < limit; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const details = await Promise.all(
      batch.map((id) => fetchJson<DeckDetail>(`${ARCHIDEKT_DECK}/${id}/`)),
    );
    for (const detail of details) {
      if (!detail) continue;
      const cardCount = detail.cards?.length ?? 0;
      if (!isBrawlDeckSize(detail.size, cardCount)) continue;
      for (const cmd of commanderNamesFromDeckDetail(detail)) {
        const key = cmd.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        names.push(cmd);
        if (names.length >= limit) break;
      }
    }
  }

  if (names.length === 0) {
    return { source: 'scryfall', status: 404, names: [], limitedData: true };
  }
  return { source: 'archidekt', status: 200, names, limitedData: names.length < 8 };
}

/** Server-side top commanders: Moxfield, then Archidekt recent Brawl decks. */
export async function fetchBrawlTopCommandersServer(): Promise<BrawlTopCommandersResponse> {
  const mox = await moxfieldTopCommanders();
  if (mox.source === 'moxfield' && mox.names.length > 0) {
    return mox;
  }
  const arch = await archidektTopCommanders();
  if (arch.names.length > 0) {
    return arch;
  }
  return { source: 'scryfall', status: mox.status || arch.status || 503, names: [], limitedData: true };
}

export async function fetchBrawlTopCommandersProxied(): Promise<BrawlTopCommandersResponse> {
  const proxied = await fetchAnalyticsAction<BrawlTopCommandersResponse>('brawl-top-commanders');
  if (proxied?.names?.length) return proxied;

  const { topCommandersFromSnapshot } = await import('@/services/brawl/brawlCommunitySnapshot');
  const fromSnapshot = await topCommandersFromSnapshot();
  if (fromSnapshot?.names?.length) return fromSnapshot;

  if (!buildAnalyticsActionUrl('brawl-top-commanders')) {
    return { source: 'scryfall', status: 503, names: [], limitedData: true };
  }
  return { source: 'scryfall', status: proxied?.status ?? 502, names: [], limitedData: true };
}
