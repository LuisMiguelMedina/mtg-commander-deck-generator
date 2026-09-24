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
