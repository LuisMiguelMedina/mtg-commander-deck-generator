import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';

export const MOXFIELD_SEARCH_URL = 'https://api2.moxfield.com/v2/decks/search';
export const MOXFIELD_MAX_REQUESTS_PER_SECOND = 1;
export const MOXFIELD_RETRY_STATUSES = [429, 500] as const;
export const MOXFIELD_USER_AGENT = 'Manafoundry/1.0 (+https://github.com/LuisMiguelMedina/mtg-commander-deck-generator)';
export const MOXFIELD_TIMEOUT_MS = 30_000;

const DAY_MS = 24 * 60 * 60 * 1000;
export const MOXFIELD_CACHE_TTL_MS = 14 * DAY_MS;
export const MOXFIELD_DEXIE_STORE = 'moxfieldResponses' as const;

const MIN_SPACING_MS = Math.ceil(1000 / MOXFIELD_MAX_REQUESTS_PER_SECOND);

const globalQueue = createMoxfieldQueue();

export type MoxfieldQueue = {
  schedule: (task: () => Promise<void>) => Promise<void>;
};

/** Serial queue spacing requests by at least 1 / MOXFIELD_MAX_REQUESTS_PER_SECOND. */
export function createMoxfieldQueue(): MoxfieldQueue {
  let chain: Promise<void> = Promise.resolve();
  let lastRunAt = 0;

  return {
    schedule(task: () => Promise<void>): Promise<void> {
      const run = chain.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, MIN_SPACING_MS - (now - lastRunAt));
        if (waitMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, waitMs);
          });
        }
        lastRunAt = Date.now();
        await task();
      });
      chain = run.catch(() => {
        /* keep queue alive after a failed task */
      });
      return run;
    },
  };
}

export type MoxfieldSearchCard = {
  name: string;
  inclusion?: number;
  count?: number;
};

export type MoxfieldSearchResult = {
  status: number;
  numDecks?: number;
  cards?: MoxfieldSearchCard[];
};

export { MOXFIELD_BRAWL100_FMT };

type MoxfieldApiCard = {
  card?: { name?: string };
  name?: string;
  inclusion?: number;
  count?: number;
};

type MoxfieldApiResponse = {
  totalRecords?: number;
  data?: Array<{
    mainboard?: MoxfieldApiCard[];
  }>;
};

/** Search Moxfield for Brawl 100 (historicBrawl) decks with the given commander. */
export async function searchBrawl100Decks(commanderName: string): Promise<MoxfieldSearchResult> {
  let status = 0;
  let numDecks = 0;
  let cards: MoxfieldSearchCard[] = [];

  await globalQueue.schedule(async () => {
    const params = new URLSearchParams({
      commanderNameOrId: commanderName,
      fmt: MOXFIELD_BRAWL100_FMT,
      pageSize: '24',
      pageNumber: '1',
    });
    const url = `${MOXFIELD_SEARCH_URL}?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MOXFIELD_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': MOXFIELD_USER_AGENT },
        signal: controller.signal,
      });
      status = response.status;
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as MoxfieldApiResponse;
      numDecks = body.totalRecords ?? 0;
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
      cards = [...tallies.entries()]
        .map(([name, stats]) => ({
          name,
          inclusion: numDecks > 0 ? Math.round((stats.inclusion / numDecks) * 100) : stats.inclusion,
          count: stats.count,
        }))
        .sort((a, b) => (b.inclusion ?? 0) - (a.inclusion ?? 0));
    } catch {
      status = status || 0;
    } finally {
      clearTimeout(timeout);
    }
  });

  return { status, numDecks, cards };
}
