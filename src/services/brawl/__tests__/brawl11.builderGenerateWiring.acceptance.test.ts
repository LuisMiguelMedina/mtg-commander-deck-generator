import { afterEach, describe, expect, it, vi } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import * as legality from '@/services/scryfall/legality';
import * as provider from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-11 acceptance (red until Builder generate follows FormatMode).
 * docs/pbi/PBI-BRAWL-11-builder-generate-wiring.md
 * docs/architecture/ADR-brawl-ui-wiring.md
 *
 * Reuses isEligibleCommander, isLegalForFormat, popularityProviderFor,
 * getBrawl100Popularity, and MOXFIELD_POPULARITY_ENABLED_DEFAULT.
 *
 * Intended seam: `resolveBuilderFormatPipeline` from
 * `src/services/brawl/builderFormatPipeline.ts`.
 * BuilderPage or generateDeck must call it with the store formatMode.
 *
 *   resolveBuilderFormatPipeline({
 *     formatMode, commander, pool, search, fetchEdhrecThemes,
 *   }) => {
 *     blocked, generation, commanderEligible, legalCardNames,
 *     popularityProviderId, dataSource, themesFetched, themes,
 *   }
 *
 * brawl100 calls isEligibleCommander(card, 'brawl100'), isLegalForFormat(card, 'brawl100'),
 * popularityProviderFor('brawl100'), and getBrawl100Popularity({
 *   flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT, search,
 * }). A 403 search degrades to dataSource 'scryfall'. EDHREC themes are not fetched.
 * commander keeps the EDHREC theme fetch and does not call getBrawl100Popularity.
 * standardBrawl60 does not generate (throws, blocked, or generation 'named-only').
 *
 * Today BuilderPage.generateDeck is the commander/EDHREC path only.
 */

const PIPELINE_MODULE = '@/services/brawl/builderFormatPipeline';

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

type PipelineInput = {
  formatMode: string;
  commander: CardFace;
  pool: PoolCard[];
  search: () => Promise<{ status: number; numDecks?: number; cards?: unknown[] }>;
  fetchEdhrecThemes: () => Promise<unknown[]>;
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

async function loadPipeline(): Promise<((input: PipelineInput) => Promise<PipelineResult>) | undefined> {
  const mod = await tryLoadSeam(PIPELINE_MODULE);
  return mod?.resolveBuilderFormatPipeline as ((input: PipelineInput) => Promise<PipelineResult>) | undefined;
}

describe('PBI-BRAWL-11 Builder generate FormatMode wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('brawl100 generate uses brawl eligibility, brawl legality, and Moxfield popularity with scryfall degrade', async () => {
    const expectedEligible = formatMode.isEligibleCommander(planeswalker, 'brawl100');
    const expectedLegal = pool
      .filter((card) => legality.isLegalForFormat(card, 'brawl100'))
      .map((card) => card.name);
    const eligible = vi.spyOn(formatMode, 'isEligibleCommander');
    const legal = vi.spyOn(legality, 'isLegalForFormat');
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const resolve = await loadPipeline();
    const search = vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] }));
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

    expect(result.blocked).toBe(false);
    expect(result.generation).toBe('implemented');
    expect(eligible).toHaveBeenCalledWith(
      expect.objectContaining({ name: planeswalker.name }),
      'brawl100',
    );
    expect(result.commanderEligible).toBe(expectedEligible);
    expect(legal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thought Monitor' }), 'brawl100');
    expect(legal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sol Ring' }), 'brawl100');
    expect(result.legalCardNames).toEqual(expectedLegal);
    expect(providerFor).toHaveBeenCalledWith('brawl100');
    expect(result.popularityProviderId).toBe('moxfield');
    expect(popularity).toHaveBeenCalledWith(expect.objectContaining({
      commanderName: planeswalker.name,
      flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
    }));
    expect(MOXFIELD_POPULARITY_ENABLED_DEFAULT).toBe(true);
    expect(search).toHaveBeenCalled();
    expect(result.dataSource).toBe('scryfall');
  });

  it('brawl100 does not fetch EDHREC themes', async () => {
    const resolve = await loadPipeline();
    const fetchEdhrecThemes = vi.fn(async () => [{ name: 'Tokens', slug: 'tokens' }]);

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    const result = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search: vi.fn(async () => ({ status: 403 })),
      fetchEdhrecThemes,
    });

    expect(fetchEdhrecThemes).not.toHaveBeenCalled();
    expect(result.themesFetched).toBe(false);
    expect(result.themes).toEqual([]);
  });

  it('commander generate keeps the EDHREC popularity path', async () => {
    const expectedEligible = formatMode.isEligibleCommander(planeswalker, 'commander');
    const expectedLegal = pool
      .filter((card) => legality.isLegalForFormat(card, 'commander'))
      .map((card) => card.name);
    const eligible = vi.spyOn(formatMode, 'isEligibleCommander');
    const legal = vi.spyOn(legality, 'isLegalForFormat');
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const resolve = await loadPipeline();
    const themes = [{ name: 'Tokens', slug: 'tokens' }];
    const fetchEdhrecThemes = vi.fn(async () => themes);
    const search = vi.fn(async () => ({ status: 200, numDecks: 10, cards: [] }));

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
    expect(result.generation).toBe('implemented');
    expect(providerFor).toHaveBeenCalledWith('commander');
    expect(result.popularityProviderId).toBe('edhrec');
    expect(fetchEdhrecThemes).toHaveBeenCalledTimes(1);
    expect(result.themesFetched).toBe(true);
    expect(result.themes).toEqual(themes);
    expect(popularity).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(eligible).toHaveBeenCalledWith(
      expect.objectContaining({ name: planeswalker.name }),
      'commander',
    );
    expect(result.commanderEligible).toBe(expectedEligible);
    expect(legal).toHaveBeenCalledWith(expect.anything(), 'commander');
    expect(result.legalCardNames).toEqual(expectedLegal);
  });

  it('standardBrawl60 does not generate', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const resolve = await loadPipeline();
    const search = vi.fn(async () => ({ status: 200, numDecks: 10, cards: [] }));
    const fetchEdhrecThemes = vi.fn(async () => [{ name: 'Tokens' }]);

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    let threw = false;
    let result: PipelineResult | undefined;
    try {
      result = await resolve({
        formatMode: 'standardBrawl60',
        commander: planeswalker,
        pool,
        search,
        fetchEdhrecThemes,
      });
    } catch {
      threw = true;
    }

    expect(threw || result?.blocked === true || result?.generation === 'named-only').toBe(true);
    expect(search).not.toHaveBeenCalled();
    expect(fetchEdhrecThemes).not.toHaveBeenCalled();
    expect(popularity).not.toHaveBeenCalled();
  });

  it('BuilderPage or generateDeck calls resolveBuilderFormatPipeline with formatMode', async () => {
    const builder = await readRepoText('src/pages/BuilderPage.tsx');
    const generator = await readRepoText('src/services/deckBuilder/deckGenerator.ts');
    const wired = [builder, generator].some((source) => (
      source.includes('resolveBuilderFormatPipeline') && /\bformatMode\b/.test(source)
    ));

    expect(wired, 'Builder generate wiring').toBe(true);
  });
});
