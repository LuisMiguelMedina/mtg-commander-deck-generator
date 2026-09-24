import { describe, expect, it, vi } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText, repoPathExists, walkRepoTs } from '@/test/repoFs';

/**
 * PBI-BRAWL-03 acceptance (red until PopularityProvider + Moxfield client exist).
 * docs/pbi/PBI-BRAWL-03-popularity-moxfield.md
 *
 * VoBo (Luis): flag ON by default. That overrides the ADR checklist line
 * "flag off until support email". Degrade to DeckDataSource `scryfall` on
 * 403 / Cloudflare / timeout / 5xx. Rate ≤1 rps. Dexie cache. No CF bypass.
 *
 * Intended seams:
 *   src/services/moxfield/flags.ts   MOXFIELD_POPULARITY_ENABLED_DEFAULT = true
 *   src/services/moxfield/client.ts  search URL, ≤1 rps queue, UA, Dexie store, TTL
 *   src/services/popularity/provider.ts
 *     popularityProviderFor('commander' | 'brawl100')
 *     getBrawl100Popularity({ commanderName, flagEnabled, search })
 *
 * Today popularity is the EDHREC client (`src/services/edhrec/client.ts`,
 * in-memory rate ~100ms, Dexie store `edhrecResponses` in
 * `src/services/scryfall/cache.ts`). `DeckDataSource` already includes `'scryfall'`
 * (`src/types/index.ts`). There is no Moxfield client and no PopularityProvider.
 */

const FLAGS_MODULE = '@/services/moxfield/flags';
const CLIENT_MODULE = '@/services/moxfield/client';
const PROVIDER_MODULE = '@/services/popularity/provider';
const CLIENT_PATH = 'src/services/moxfield/client.ts';
const MOXFIELD_DIR = 'src/services/moxfield';
const SEARCH_URL = 'https://api2.moxfield.com/v2/decks/search';

type SearchResult = {
  status: number;
  numDecks?: number;
  cards?: Array<{ name: string; inclusion?: number; count?: number }>;
};

type PopularityResult = {
  dataSource?: string;
  limitedData?: boolean;
  numDecks?: number;
  fmt?: string;
  cards?: Array<{ name: string; inclusion?: number; count?: number }>;
};

describe('PBI-BRAWL-03 PopularityProvider + Moxfield', () => {
  it('Moxfield popularity flag defaults to ON', async () => {
    const mod = await tryLoadSeam(FLAGS_MODULE);
    expect(mod?.MOXFIELD_POPULARITY_ENABLED_DEFAULT, FLAGS_MODULE).toBe(true);
  });

  it('routes commander popularity to EDHREC and brawl100 to Moxfield', async () => {
    const mod = await tryLoadSeam(PROVIDER_MODULE);
    const providerFor = mod?.popularityProviderFor as ((mode: string) => { id?: string }) | undefined;
    const commander = typeof providerFor === 'function' ? providerFor('commander') : undefined;
    const brawl = typeof providerFor === 'function' ? providerFor('brawl100') : undefined;

    expect(commander?.id).toBe('edhrec');
    expect(brawl?.id).toBe('moxfield');
  });

  it('degrades to DeckDataSource scryfall when Moxfield returns 403', async () => {
    const result = await popularity({ status: 403 });
    expect(result?.dataSource).toBe('scryfall');
  });

  it('degrades to scryfall on 5xx and on timeout', async () => {
    expect((await popularity({ status: 503 }))?.dataSource).toBe('scryfall');
    expect((await popularity(new Error('timeout')))?.dataSource).toBe('scryfall');
  });

  it('normalizes a successful search to inclusion, numDecks, and the spike fmt', async () => {
    const result = await popularity({
      status: 200,
      numDecks: 40,
      cards: [{ name: 'Sol Ring', inclusion: 72, count: 29 }],
    });

    expect(result?.dataSource).toBe('moxfield');
    expect(result?.numDecks).toBe(40);
    expect(result?.cards?.[0]).toMatchObject({ name: 'Sol Ring', inclusion: 72 });
    expect(['brawl', 'historicBrawl']).toContain(result?.fmt);
  });

  it('falls back to scryfall and signals limited data when the sample is too small', async () => {
    const result = await popularity({
      status: 200,
      numDecks: 0,
      cards: [],
    });

    expect(result?.dataSource).toBe('scryfall');
    expect(result?.limitedData).toBe(true);
  });

  it('Moxfield client rate contract is at most 1 request per second', async () => {
    const mod = await tryLoadSeam(CLIENT_MODULE);
    const rps = mod?.MOXFIELD_MAX_REQUESTS_PER_SECOND as number | undefined;

    expect(rps, 'MOXFIELD_MAX_REQUESTS_PER_SECOND').toBeLessThanOrEqual(1);
    expect(rps).toBeGreaterThan(0);
    expect(mod?.MOXFIELD_RETRY_STATUSES).toEqual(expect.arrayContaining([429, 500]));
    expect(mod?.MOXFIELD_USER_AGENT).toEqual(expect.any(String));
    expect(String(mod?.MOXFIELD_USER_AGENT ?? '')).toMatch(/\S/);
    expect(mod?.MOXFIELD_TIMEOUT_MS).toEqual(expect.any(Number));
    expect(mod?.MOXFIELD_TIMEOUT_MS as number).toBeGreaterThan(0);
  });

  it('spaces queued Moxfield requests by at least 1000ms', async () => {
    const mod = await tryLoadSeam(CLIENT_MODULE);
    const createQueue = mod?.createMoxfieldQueue as (() => {
      schedule: (task: () => Promise<void>) => Promise<void>;
    }) | undefined;
    const stamps: number[] = [];

    if (typeof createQueue === 'function') {
      vi.useFakeTimers();
      try {
        const queue = createQueue();
        const first = queue.schedule(async () => {
          stamps.push(Date.now());
        });
        const second = queue.schedule(async () => {
          stamps.push(Date.now());
        });
        await vi.runAllTimersAsync();
        await Promise.all([first, second]);
      } finally {
        vi.useRealTimers();
      }
    }

    expect(stamps).toHaveLength(2);
    expect(stamps[1]! - stamps[0]!).toBeGreaterThanOrEqual(1000);
  });

  it('searches https://api2.moxfield.com/v2/decks/search', async () => {
    const mod = await tryLoadSeam(CLIENT_MODULE);
    expect(mod?.MOXFIELD_SEARCH_URL).toBe(SEARCH_URL);
  });

  it('caches Moxfield responses in Dexie for 7 to 14 days', async () => {
    const mod = await tryLoadSeam(CLIENT_MODULE);
    const day = 24 * 60 * 60 * 1000;
    const ttl = mod?.MOXFIELD_CACHE_TTL_MS as number | undefined;

    expect(['moxfieldResponses', 'externalResponses']).toContain(mod?.MOXFIELD_DEXIE_STORE);
    expect(ttl).toBeGreaterThanOrEqual(7 * day);
    expect(ttl).toBeLessThanOrEqual(14 * day);
  });

  it('moxfield client path does not reference cf_clearance or a Cloudflare bypass cookie', async () => {
    expect(await repoPathExists(CLIENT_PATH), CLIENT_PATH).toBe(true);

    const files = (await walkRepoTs(MOXFIELD_DIR)).filter((file) => !file.includes('/__tests__/'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readRepoText(file);
      expect(source, file).not.toMatch(/cf_clearance|cf-clearance/);
    }
  });
});

async function popularity(search: SearchResult | Error): Promise<PopularityResult | undefined> {
  const mod = await tryLoadSeam(PROVIDER_MODULE);
  const getPopularity = mod?.getBrawl100Popularity as ((input: {
    commanderName: string;
    flagEnabled: boolean;
    search: () => Promise<SearchResult>;
  }) => Promise<PopularityResult>) | undefined;
  if (typeof getPopularity !== 'function') return undefined;
  return getPopularity({
    commanderName: 'Ragavan, Nimble Pilferer',
    flagEnabled: true,
    search: async () => {
      if (search instanceof Error) throw search;
      return search;
    },
  });
}

