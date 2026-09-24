import { afterEach, describe, expect, it, vi } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import * as legality from '@/services/scryfall/legality';
import * as provider from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-20 acceptance (red until generateDeck builds a real brawl100 pool).
 * docs/pbi/PBI-BRAWL-20-generate-real-brawl100.md
 * docs/architecture/ADR-brawl-ui-followup-pr4.md
 *
 * Reuses isLegalForFormat, getFormatRules, getBrawl100Popularity, and
 * MOXFIELD_POPULARITY_ENABLED_DEFAULT. Does not rewrite the scorer.
 *
 * Intended seams on `src/services/brawl/builderFormatPipeline.ts`:
 *   buildLegalFormatPool(candidates, formatMode)
 *     cards for which isLegalForFormat(card, formatMode) is true (not names only)
 *   adaptMoxfieldCardsToRanking(cards)
 *     Moxfield { name, inclusion?, count? } → ranking { name, inclusion, count? }
 *     inclusion = card.inclusion ?? card.count ?? 0; count kept when present
 *   resolveBuilderFormatPipeline({
 *     formatMode, commander, pool, search, fetchEdhrecThemes, flagEnabled?,
 *   }) => {
 *     ...existing fields,
 *     deckSize,          // getFormatRules(formatMode).deckSize
 *     rankingCards,      // adapted cards when dataSource is 'moxfield'; [] on degrade
 *   }
 *   flagEnabled omitted → MOXFIELD_POPULARITY_ENABLED_DEFAULT (ON).
 *   flagEnabled false → do not call search; dataSource 'scryfall'; rankingCards [].
 *   403 / 5xx / empty sample → dataSource 'scryfall', legal pool kept, rankingCards [].
 *
 * Production wiring in `src/services/deckBuilder/deckGenerator.ts` `generateDeck`:
 *   pool is buildLegalFormatPool(...) — not `pool: []`
 *   search is a real Moxfield search — not `async () => ({ status: 403 })`
 *   deck size is getFormatRules(formatMode).deckSize — not customization.deckFormat
 *   ranking path consumes rankingCards / adaptMoxfieldCardsToRanking
 *   commander still fetches EDHREC and does not call getBrawl100Popularity
 *
 * On 029c258 generateDeck still passes pool: [] and a search that always
 * returns 403. The pipeline drops Moxfield cards, omits deckSize, and ignores
 * a flagEnabled override.
 */

const PIPELINE_MODULE = '@/services/brawl/builderFormatPipeline';
const GENERATOR_PATH = 'src/services/deckBuilder/deckGenerator.ts';

type CardFace = {
  name: string;
  type_line: string;
  color_identity: string[];
};

type PoolCard = {
  name: string;
  legalities?: Record<string, string>;
  games?: string[];
};

type RankingCard = {
  name: string;
  inclusion?: number;
  count?: number;
};

type PipelineInput = {
  formatMode: string;
  commander: CardFace;
  pool: PoolCard[];
  search: () => Promise<{ status: number; numDecks?: number; cards?: RankingCard[] }>;
  fetchEdhrecThemes: () => Promise<unknown[]>;
  flagEnabled?: boolean;
};

type PipelineResult = {
  blocked?: boolean;
  generation?: string;
  commanderEligible?: boolean;
  legalCardNames?: string[];
  popularityProviderId?: string;
  dataSource?: string;
  themesFetched?: boolean;
  themes?: unknown[];
  deckSize?: number;
  rankingCards?: RankingCard[];
};

const planeswalker: CardFace = {
  name: 'Jace, the Mind Sculptor',
  type_line: 'Legendary Planeswalker — Jace',
  color_identity: ['U'],
};

const pool: PoolCard[] = [
  { name: 'Thought Monitor', legalities: { brawl: 'legal', commander: 'legal' } },
  { name: 'Sol Ring', legalities: { brawl: 'not_legal', commander: 'legal' } },
];

const solRingRanking: RankingCard = { name: 'Sol Ring', inclusion: 72, count: 29 };

async function loadPipeline(): Promise<((input: PipelineInput) => Promise<PipelineResult>) | undefined> {
  const mod = await tryLoadSeam(PIPELINE_MODULE);
  return mod?.resolveBuilderFormatPipeline as ((input: PipelineInput) => Promise<PipelineResult>) | undefined;
}

function pipelineInvocation(source: string): string {
  const marker = 'resolveBuilderFormatPipeline(';
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const slice = source.slice(start, start + 800);
  const end = slice.indexOf('});');
  return end < 0 ? slice : slice.slice(0, end + 3);
}

function generateDeckBody(source: string): string {
  const signature = 'export async function generateDeck';
  const start = source.indexOf(signature);
  return start < 0 ? '' : source.slice(start);
}

describe('PBI-BRAWL-20 generateDeck real brawl100 (remove stub)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildLegalFormatPool keeps only cards isLegalForFormat accepts for brawl100', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const build = mod?.buildLegalFormatPool as
      | ((candidates: PoolCard[], formatMode: string) => PoolCard[])
      | undefined;
    const expected = pool
      .filter((card) => legality.isLegalForFormat(card, 'brawl100'))
      .map((card) => card.name);

    expect(typeof build, `${PIPELINE_MODULE} buildLegalFormatPool`).toBe('function');
    if (typeof build !== 'function') return;

    const legal = vi.spyOn(legality, 'isLegalForFormat');
    const kept = build(pool, 'brawl100');

    expect(legal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thought Monitor' }), 'brawl100');
    expect(legal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sol Ring' }), 'brawl100');
    expect(kept.map((card) => card.name)).toEqual(expected);
    expect(expected).toEqual(['Thought Monitor']);
  });

  it('adaptMoxfieldCardsToRanking maps Moxfield cards onto the EDHREC ranking shape', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const adapt = mod?.adaptMoxfieldCardsToRanking as
      | ((cards: RankingCard[]) => RankingCard[])
      | undefined;

    expect(typeof adapt, `${PIPELINE_MODULE} adaptMoxfieldCardsToRanking`).toBe('function');
    if (typeof adapt !== 'function') return;

    const adapted = adapt([
      solRingRanking,
      { name: 'Arcane Signet', count: 40 },
    ]);

    expect(adapted[0]).toMatchObject({ name: 'Sol Ring', inclusion: 72, count: 29 });
    expect(adapted[1]).toMatchObject({ name: 'Arcane Signet', inclusion: 40 });
  });

  it('brawl100 popularity uses the default-on flag and returns adapted ranking cards', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const resolve = await loadPipeline();
    const search = vi.fn(async () => ({ status: 200, numDecks: 40, cards: [solRingRanking] }));
    const fetchEdhrecThemes = vi.fn(async () => [{ name: 'Tokens', slug: 'tokens' }]);

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search,
      fetchEdhrecThemes,
    });

    expect(MOXFIELD_POPULARITY_ENABLED_DEFAULT).toBe(true);
    expect(popularity).toHaveBeenCalledWith(expect.objectContaining({
      commanderName: planeswalker.name,
      flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
    }));
    expect(search).toHaveBeenCalled();
    expect(fetchEdhrecThemes).not.toHaveBeenCalled();
    expect(result.dataSource).toBe('moxfield');
    expect(result.rankingCards).toEqual([
      expect.objectContaining({ name: 'Sol Ring', inclusion: 72, count: 29 }),
    ]);
  });

  it.each([
    ['403', async () => ({ status: 403, numDecks: 0, cards: [] as RankingCard[] })],
    ['5xx', async () => ({ status: 503 })],
    ['empty sample', async () => ({ status: 200, numDecks: 0, cards: [] as RankingCard[] })],
  ])('degrades to scryfall with the legal pool and no ranking on %s', async (_label, searchImpl) => {
    const resolve = await loadPipeline();
    const expectedLegal = pool
      .filter((card) => legality.isLegalForFormat(card, 'brawl100'))
      .map((card) => card.name);

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search: vi.fn(searchImpl),
      fetchEdhrecThemes: vi.fn(async () => [{ name: 'Tokens' }]),
    });

    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('scryfall');
    expect(result.legalCardNames).toEqual(expectedLegal);
    expect(result.rankingCards).toEqual([]);
  });

  it('flag off degrades to scryfall without calling search and without ranking', async () => {
    const resolve = await loadPipeline();
    const search = vi.fn(async () => ({ status: 200, numDecks: 12, cards: [solRingRanking] }));
    const expectedLegal = pool
      .filter((card) => legality.isLegalForFormat(card, 'brawl100'))
      .map((card) => card.name);

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search,
      fetchEdhrecThemes: vi.fn(async () => []),
      flagEnabled: false,
    });

    expect(search).not.toHaveBeenCalled();
    expect(result.dataSource).toBe('scryfall');
    expect(result.legalCardNames).toEqual(expectedLegal);
    expect(result.rankingCards).toEqual([]);
    expect(result.blocked).toBe(false);
  });

  it('brawl100 generate deck size is getFormatRules(brawl100).deckSize (99)', async () => {
    const expectedSize = formatMode.getFormatRules('brawl100')?.deckSize;
    const rules = vi.spyOn(formatMode, 'getFormatRules');
    const resolve = await loadPipeline();

    expect(expectedSize).toBe(99);
    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search: vi.fn(async () => ({ status: 403 })),
      fetchEdhrecThemes: vi.fn(async () => []),
    });

    expect(result.deckSize).toBe(expectedSize);
    expect(rules).toHaveBeenCalledWith('brawl100');
  });

  it('generateDeck feeds a legal pool into the pipeline instead of pool: []', async () => {
    const source = await readRepoText(GENERATOR_PATH);
    const call = pipelineInvocation(source);

    expect(call, `${GENERATOR_PATH} resolveBuilderFormatPipeline(...)`).toMatch(/resolveBuilderFormatPipeline\(/);
    expect(call).not.toMatch(/pool:\s*\[\s*\]/);
    expect(call).toMatch(/buildLegalFormatPool\s*\(/);
  });

  it('generateDeck does not pass a search that always returns 403', async () => {
    const source = await readRepoText(GENERATOR_PATH);
    const call = pipelineInvocation(source);

    expect(call, `${GENERATOR_PATH} resolveBuilderFormatPipeline(...)`).toMatch(/resolveBuilderFormatPipeline\(/);
    expect(call).not.toMatch(/status:\s*403/);
    expect(call).not.toMatch(/search:\s*async\s*\(\)\s*=>\s*\(\{\s*status:\s*403\s*\}\)/);
  });

  it('generateDeck ranks with the Moxfield adapter and sizes from getFormatRules(formatMode)', async () => {
    const body = generateDeckBody(await readRepoText(GENERATOR_PATH));

    const usesFormatRules = /getFormatRules\s*\(\s*formatMode\s*\)/.test(body);
    const usesChipSize = /const format = customization\.deckFormat/.test(body);
    const usesRankingAdapter = /adaptMoxfieldCardsToRanking|rankingCards/.test(body);

    expect(usesFormatRules, 'generateDeck sizes from getFormatRules(formatMode)').toBe(true);
    expect(usesChipSize, 'generateDeck still assigns format from customization.deckFormat').toBe(false);
    expect(usesRankingAdapter, 'generateDeck consumes rankingCards or adaptMoxfieldCardsToRanking').toBe(true);
  });

  it('commander generate still uses the EDHREC popularity path', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const resolve = await loadPipeline();
    const themes = [{ name: 'Tokens', slug: 'tokens' }];
    const fetchEdhrecThemes = vi.fn(async () => themes);
    const search = vi.fn(async () => ({ status: 200, numDecks: 10, cards: [solRingRanking] }));

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'commander',
      commander: planeswalker,
      pool,
      search,
      fetchEdhrecThemes,
    });

    expect(result.blocked).toBe(false);
    expect(providerFor).toHaveBeenCalledWith('commander');
    expect(result.popularityProviderId).toBe('edhrec');
    expect(fetchEdhrecThemes).toHaveBeenCalledTimes(1);
    expect(result.themes).toEqual(themes);
    expect(popularity).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});
