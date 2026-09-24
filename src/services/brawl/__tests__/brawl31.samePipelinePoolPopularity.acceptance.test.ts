import { afterEach, describe, expect, it, vi } from 'vitest';
import * as provider from '@/services/popularity/provider';
import * as legality from '@/services/scryfall/legality';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-31 acceptance (red until commander and brawl100 share one pipeline).
 * docs/pbi/PBI-BRAWL-31-same-pipeline-pool-popularity.md
 * docs/architecture/ADR-brawl-residuales-pr5.md
 *
 * Product principle: the same generate/store/scorer. formatMode only switches
 * (1) the Scryfall legal pool and (2) popularity (Moxfield vs EDHREC).
 * No scorer rewrite.
 *
 * Intended thin seam on `src/services/brawl/builderFormatPipeline.ts`:
 *   selectFormatFill({
 *     legalCardNames,                 // pipeline.legalCardNames — the legal pool
 *     rankingCards?: { name }[],      // adapted Moxfield cards; [] on degrade
 *     edhrecNames?: string[],         // names the EDHREC overlay would have used
 *   }) => { names: string[] }
 *     every returned name is in legalCardNames (the pool constrains selection)
 *     ranking names outside the legal pool are dropped
 *     edhrecNames outside the legal pool are dropped (no EDHREC-only fill)
 *     when rankingCards is empty, names are the legal pool (degrade fills from it)
 *     when legalCardNames is empty, names is [] (do not fill from EDHREC)
 *
 * Production wiring:
 *   `generateDeck` in `src/services/deckBuilder/deckGenerator.ts`
 *     calls selectFormatFill with pipeline.legalCardNames
 *     does not keep the brawl100 EDHREC typed-list overlay
 *       (`lists?.instants` / `formatMode === 'brawl100' && rankingCards.length > 0`)
 *     pool passed to resolveBuilderFormatPipeline is buildLegalFormatPool(...), not []
 *     search is searchBrawl100Decks(...), not `async () => ({ status: 403 })`
 *   `prepareBrewContext` in `src/services/brew/prepareBrewContext.ts`
 *     same real searchBrawl100Decks path — the `search: async () => ({ status: 403 })`
 *     stub is gone. Degrade still happens when that search returns 403.
 *
 * On 44bd898 generateDeck already passes a filtered pool and searchBrawl100Decks,
 * and the pipeline already degrades a 403 to dataSource 'scryfall'. The residual
 * is that legalCardNames is never read: the EDHREC overlay fills the deck.
 * prepareBrewContext still stubs search → 403. Commander EDHREC is unchanged.
 */

const PIPELINE_MODULE = '@/services/brawl/builderFormatPipeline';
const BREW_PIPELINE_MODULE = '@/services/brawl/brewFormatPipeline';
const GENERATOR_PATH = 'src/services/deckBuilder/deckGenerator.ts';
const PREPARE_BREW_PATH = 'src/services/brew/prepareBrewContext.ts';

type FillInput = {
  legalCardNames: string[];
  rankingCards?: Array<{ name: string; inclusion?: number }>;
  edhrecNames?: string[];
};

type FillResult = { names: string[] };

type RankingCard = { name: string; inclusion?: number; count?: number };

type PipelineResult = {
  blocked?: boolean;
  generation?: string;
  legalCardNames?: string[];
  popularityProviderId?: string;
  dataSource?: string;
  themesFetched?: boolean;
  themes?: unknown[];
  rankingCards?: RankingCard[];
};

const planeswalker = {
  name: 'Jace, the Mind Sculptor',
  type_line: 'Legendary Planeswalker — Jace',
  color_identity: ['U'],
};

const pool = [
  { name: 'Thought Monitor', legalities: { brawl: 'legal', commander: 'legal' } },
  { name: 'Sol Ring', legalities: { brawl: 'not_legal', commander: 'legal' } },
];

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return '';
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + signature.length + next);
}

function pipelineInvocation(source: string): string {
  const marker = 'resolveBuilderFormatPipeline(';
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const slice = source.slice(start, start + 800);
  const end = slice.indexOf('});');
  return end < 0 ? slice : slice.slice(0, end + 3);
}

function brewPlanInvocation(source: string): string {
  const marker = 'resolveBrewFormatPlan(';
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const slice = source.slice(start, start + 800);
  const end = slice.indexOf('});');
  return end < 0 ? slice : slice.slice(0, end + 3);
}

describe('PBI-BRAWL-31 same pipeline; only legal pool and popularity differ', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selectFormatFill keeps legal-pool names and drops EDHREC-only names', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const select = mod?.selectFormatFill as ((input: FillInput) => FillResult) | undefined;

    expect(typeof select, `${PIPELINE_MODULE} selectFormatFill`).toBe('function');
    if (typeof select !== 'function') return;

    const ranked = select({
      legalCardNames: ['Thought Monitor', 'Counterspell'],
      rankingCards: [
        { name: 'Sol Ring', inclusion: 80 },
        { name: 'Counterspell', inclusion: 40 },
      ],
      edhrecNames: ['Sol Ring', 'Rhystic Study'],
    });
    const degraded = select({
      legalCardNames: ['Thought Monitor'],
      rankingCards: [],
      edhrecNames: ['Sol Ring', 'Rhystic Study'],
    });
    const emptyPool = select({
      legalCardNames: [],
      rankingCards: [{ name: 'Sol Ring', inclusion: 90 }],
      edhrecNames: ['Sol Ring', 'Rhystic Study'],
    });

    expect(new Set(ranked.names)).toEqual(new Set(['Thought Monitor', 'Counterspell']));
    expect(ranked.names).not.toContain('Sol Ring');
    expect(ranked.names).not.toContain('Rhystic Study');
    expect(new Set(degraded.names)).toEqual(new Set(['Thought Monitor']));
    expect(degraded.names).not.toContain('Sol Ring');
    expect(emptyPool.names).toEqual([]);
  });

  it('generateDeck fills brawl100 from legalCardNames instead of the EDHREC overlay', async () => {
    const body = functionBody(await readRepoText(GENERATOR_PATH), 'export async function generateDeck');

    expect(body, 'generateDeck').not.toBe('');
    expect(body, 'generateDeck never reads legalCardNames').toMatch(/\blegalCardNames\b/);
    expect(body, 'generateDeck does not call selectFormatFill').toMatch(/selectFormatFill\s*\(/);
    expect(body, 'brawl100 still copies EDHREC typed lists into the fill').not.toMatch(/lists\?\.instants/);
    expect(body, 'brawl100 still overlays EDHREC only when Moxfield ranking is non-empty').not.toMatch(
      /formatMode === 'brawl100' && rankingCards\.length > 0/,
    );
  });

  it('prepareBrewContext uses searchBrawl100Decks instead of an always-403 stub', async () => {
    const call = brewPlanInvocation(await readRepoText(PREPARE_BREW_PATH));

    expect(call, `${PREPARE_BREW_PATH} resolveBrewFormatPlan(...)`).toMatch(/resolveBrewFormatPlan\(/);
    expect(call, 'prepareBrewContext still stubs search → 403').not.toMatch(/status:\s*403/);
    expect(call, 'prepareBrewContext does not call the real Moxfield search').toMatch(
      /searchBrawl100Decks\s*\(/,
    );
  });

  it('generateDeck passes a real legal pool and a real Moxfield search', async () => {
    const call = pipelineInvocation(await readRepoText(GENERATOR_PATH));

    expect(call, `${GENERATOR_PATH} resolveBuilderFormatPipeline(...)`).toMatch(
      /resolveBuilderFormatPipeline\(/,
    );
    expect(call, 'generateDeck still passes pool: []').not.toMatch(/pool:\s*\[\s*\]/);
    expect(call, 'generateDeck does not build the legal pool').toMatch(/buildLegalFormatPool\s*\(/);
    expect(call, 'generateDeck still stubs search → 403').not.toMatch(/status:\s*403/);
    expect(call, 'generateDeck does not call the real Moxfield search').toMatch(
      /searchBrawl100Decks\s*\(/,
    );
  });

  it('a 403 search still degrades to the legal pool without blocking generate or brew', async () => {
    const builderMod = await tryLoadSeam(PIPELINE_MODULE);
    const brewMod = await tryLoadSeam(BREW_PIPELINE_MODULE);
    const resolve = builderMod?.resolveBuilderFormatPipeline as ((input: {
      formatMode: string;
      commander: typeof planeswalker;
      pool: typeof pool;
      search: () => Promise<{ status: number; numDecks?: number; cards?: RankingCard[] }>;
      fetchEdhrecThemes: () => Promise<unknown[]>;
    }) => Promise<PipelineResult>) | undefined;
    const plan = brewMod?.resolveBrewFormatPlan as ((input: {
      customization: { formatMode?: string; deckFormat: number };
      commanderName: string;
      search: () => Promise<{ status: number; numDecks?: number; cards?: unknown[] }>;
      fetchEdhrec: () => Promise<unknown>;
    }) => Promise<{ blocked?: boolean; dataSource?: string; popularityProviderId?: string }>) | undefined;

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof resolve !== 'function' || typeof plan !== 'function') return;

    const expectedLegal = pool
      .filter((card) => legality.isLegalForFormat(card, 'brawl100'))
      .map((card) => card.name);
    const search = vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] as RankingCard[] }));

    const generated = await resolve({
      formatMode: 'brawl100',
      commander: planeswalker,
      pool,
      search,
      fetchEdhrecThemes: vi.fn(async () => [{ name: 'Tokens' }]),
    });
    const brewed = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: planeswalker.name,
      search: vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] })),
      fetchEdhrec: vi.fn(async () => ({ themes: [{ name: 'Tokens' }] })),
    });

    expect(generated.blocked).toBe(false);
    expect(generated.dataSource).toBe('scryfall');
    expect(generated.legalCardNames).toEqual(expectedLegal);
    expect(generated.rankingCards).toEqual([]);
    expect(brewed.blocked).toBe(false);
    expect(brewed.dataSource).toBe('scryfall');
    expect(brewed.popularityProviderId).toBe('moxfield');
  });

  it('commander generate still uses the EDHREC popularity path', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const resolve = mod?.resolveBuilderFormatPipeline as ((input: {
      formatMode: string;
      commander: typeof planeswalker;
      pool: typeof pool;
      search: () => Promise<{ status: number; cards?: RankingCard[] }>;
      fetchEdhrecThemes: () => Promise<unknown[]>;
    }) => Promise<PipelineResult>) | undefined;
    const themes = [{ name: 'Tokens', slug: 'tokens' }];
    const fetchEdhrecThemes = vi.fn(async () => themes);
    const search = vi.fn(async () => ({ status: 200, numDecks: 10, cards: [{ name: 'Sol Ring', inclusion: 70 }] }));

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
