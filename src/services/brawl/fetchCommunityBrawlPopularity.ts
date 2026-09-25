import { searchArchidektBrawl100Decks } from '@/services/brawl/archidektBrawl100';
import { buildAnalyticsActionUrl } from '@/services/brawl/brawlAnalyticsProxy';
import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import {
  MOXFIELD_SEARCH_URL,
  MOXFIELD_USER_AGENT,
  type MoxfieldSearchCard,
} from '@/services/moxfield/client';

export type CommunityBrawlPopularityResponse = {
  source: 'moxfield' | 'archidekt' | 'scryfall';
  status: number;
  numDecks?: number;
  cards?: MoxfieldSearchCard[];
  limitedData?: boolean;
};

async function searchMoxfieldDirect(commanderName: string): Promise<CommunityBrawlPopularityResponse> {
  const params = new URLSearchParams({
    commanderNameOrId: commanderName,
    fmt: MOXFIELD_BRAWL100_FMT,
    pageSize: '24',
    pageNumber: '1',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${MOXFIELD_SEARCH_URL}?${params.toString()}`, {
      headers: { 'User-Agent': MOXFIELD_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    const status = response.status;
    if (!response.ok) {
      return { source: 'scryfall', status, limitedData: true };
    }
    const body = (await response.json()) as {
      totalRecords?: number;
      data?: Array<{ mainboard?: Array<{ card?: { name?: string }; name?: string; count?: number }> }>;
    };
    const numDecks = body.totalRecords ?? 0;
    const tallies = new Map<string, { inclusion: number; count: number }>();
    for (const deck of body.data ?? []) {
      for (const entry of deck.mainboard ?? []) {
        const name = entry.card?.name ?? entry.name;
        if (!name) continue;
        const prev = tallies.get(name) ?? { inclusion: 0, count: 0 };
        prev.inclusion += 1;
        prev.count += entry.count ?? 1;
        tallies.set(name, prev);
      }
    }
    const cards = [...tallies.entries()]
      .map(([name, stats]) => ({
        name,
        inclusion: numDecks > 0 ? Math.round((stats.inclusion / numDecks) * 100) : stats.inclusion,
        count: stats.count,
      }))
      .sort((a, b) => (b.inclusion ?? 0) - (a.inclusion ?? 0));
    if (!numDecks || cards.length === 0) {
      return { source: 'scryfall', status: 200, limitedData: true };
    }
    return { source: 'moxfield', status: 200, numDecks, cards };
  } catch {
    return { source: 'scryfall', status: 503, limitedData: true };
  } finally {
    clearTimeout(timeout);
  }
}

/** Server-side: Moxfield first, then Archidekt public Brawl lists. */
export async function fetchCommunityBrawlPopularity(
  commanderName: string,
): Promise<CommunityBrawlPopularityResponse> {
  const mox = await searchMoxfieldDirect(commanderName);
  if (mox.source === 'moxfield' && mox.numDecks && mox.cards?.length) {
    return mox;
  }

  const arch = await searchArchidektBrawl100Decks(commanderName);
  if (arch.status === 200 && arch.numDecks && arch.numDecks > 0 && arch.cards?.length) {
    return {
      source: 'archidekt',
      status: 200,
      numDecks: arch.numDecks,
      cards: arch.cards,
      limitedData: arch.numDecks < 5,
    };
  }

  return {
    source: 'scryfall',
    status: mox.status || arch.status || 503,
    limitedData: true,
  };
}

export function buildBrawlPopularityRequestUrl(commanderName: string): string | null {
  return buildAnalyticsActionUrl('brawl-popularity', { commanderName });
}

/** Browser entry: build snapshot → analytics/dev proxy (no direct Moxfield in browser). */
export async function searchBrawl100DecksProxied(
  commanderName: string,
): Promise<CommunityBrawlPopularityResponse> {
  const { popularityFromSnapshot } = await import('@/services/brawl/brawlCommunitySnapshot');
  const fromSnapshot = await popularityFromSnapshot(commanderName);
  if (fromSnapshot) return fromSnapshot;

  const url = buildBrawlPopularityRequestUrl(commanderName);
  if (url) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const body = (await res.json()) as CommunityBrawlPopularityResponse;
        if (
          (body.source === 'moxfield' || body.source === 'archidekt') &&
          body.numDecks &&
          body.cards?.length
        ) {
          return body;
        }
      }
    } catch {
      // fall through
    }
  }

  return { source: 'scryfall', status: url ? 502 : 503, limitedData: true };
}
