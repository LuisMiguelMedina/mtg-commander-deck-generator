import { afterEach, describe, expect, it, vi } from 'vitest';
import * as provider from '@/services/popularity/provider';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-32 acceptance (red until brawl100 brew offers use Moxfield|degrade + legal pool).
 * docs/pbi/PBI-BRAWL-32-brew-brawl100-moxfield-pool.md
 *
 * Product gap at 1ae716d: `resolveBrewFormatPlan` skips `fetchEdhrec` for brawl100
 * (correct — offers must not come from EDHREC) but drops the Moxfield ranking on
 * the floor. `prepareBrewContext` still builds `candidates` only from
 * `edhrecData.cardlists.allNonLand`. With the fetch skipped, that list is the
 * empty fallback, so the pre-finishBrew offer pool is empty.
 *
 * Intended seam on `src/services/brawl/brewFormatPipeline.ts`:
 *   selectBrewOffers({
 *     legalCardNames,
 *     rankingCards?: { name, inclusion? }[],  // adapted Moxfield cards; [] on degrade
 *     edhrecNames?: string[],                  // must not become the offer source
 *   }) => { names: string[] }
 *     every returned name is in legalCardNames
 *     ranking names outside the legal pool are dropped
 *     edhrecNames outside the legal pool are dropped (no EDHREC-only offers)
 *     when rankingCards is empty, names are the legal pool (degrade fills from it)
 *     when legalCardNames is empty, names is [] (do not fill from EDHREC)
 *
 *   resolveBrewFormatPlan({
 *     customization, commanderName, search, fetchEdhrec,
 *     legalCardNames?: string[],
 *     flagEnabled?: boolean,   // default MOXFIELD_POPULARITY_ENABLED_DEFAULT
 *   }) => { ..., dataSource, candidateNames }
 *     brawl100 calls selectBrewOffers; candidateNames is that result
 *     Moxfield OK → candidateNames from Moxfield ∩ legal (non-empty when the
 *       intersection is non-empty); fetchEdhrec is not called
 *     403 / 5xx / empty / flag off → dataSource 'scryfall', not blocked,
 *       candidateNames is the legal pool (limitedData ok)
 *     commander still calls fetchEdhrec and does not call search
 *
 * Production wiring in `prepareBrewContext`:
 *   passes the legal pool into the plan (legalCardNames / buildLegalFormatPool)
 *   builds candidates from brewPlan.candidateNames (or selectBrewOffers),
 *   not only from the empty EDHREC fallback left by the skipped fetch
 *   search stays searchBrawl100Decks — no `search → 403` stub
 *   no scorer rewrite
 */

const BREW_PIPELINE_MODULE = '@/services/brawl/brewFormatPipeline';
const PREPARE_BREW_PATH = 'src/services/brew/prepareBrewContext.ts';

type RankingCard = { name: string; inclusion?: number; count?: number };

type BrewPlanInput = {
  customization: { formatMode?: string; deckFormat: number };
  commanderName: string;
  legalCardNames?: string[];
  flagEnabled?: boolean;
  search: () => Promise<{ status: number; numDecks?: number; cards?: RankingCard[] }>;
  fetchEdhrec: () => Promise<unknown>;
};

type BrewPlan = {
  blocked?: boolean;
  generation?: string;
  formatMode?: string;
  popularityProviderId?: string;
  dataSource?: string;
  candidateNames?: string[];
  limitedData?: boolean;
};

type OfferInput = {
  legalCardNames: string[];
  rankingCards?: RankingCard[];
  edhrecNames?: string[];
};

type OfferResult = { names: string[] };

const LEGAL = ['Thought Monitor', 'Counterspell', 'Brainstorm'];

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return '';
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + signature.length + next);
}

function brewPlanInvocation(source: string): string {
  const marker = 'resolveBrewFormatPlan(';
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const slice = source.slice(start, start + 900);
  const end = slice.indexOf('});');
  return end < 0 ? slice : slice.slice(0, end + 3);
}

async function loadBrewModule(): Promise<Record<string, unknown> | null> {
  return tryLoadSeam(BREW_PIPELINE_MODULE);
}

describe('PBI-BRAWL-32 brew brawl100 offers use Moxfield|degrade and the legal pool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selectBrewOffers keeps Moxfield ∩ legal names and drops EDHREC-only names', async () => {
    const mod = await loadBrewModule();
    const select = mod?.selectBrewOffers as ((input: OfferInput) => OfferResult) | undefined;

    expect(typeof select, `${BREW_PIPELINE_MODULE} selectBrewOffers`).toBe('function');
    if (typeof select !== 'function') return;

    const ranked = select({
      legalCardNames: LEGAL,
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

    expect(ranked.names).toEqual(expect.arrayContaining(['Counterspell']));
    expect(ranked.names.every((name) => LEGAL.includes(name))).toBe(true);
    expect(ranked.names).not.toContain('Sol Ring');
    expect(ranked.names).not.toContain('Rhystic Study');
    expect(ranked.names.length).toBeGreaterThan(0);
    expect(degraded.names).toEqual(['Thought Monitor']);
    expect(degraded.names).not.toContain('Sol Ring');
    expect(emptyPool.names).toEqual([]);
  });

  it('brawl100 Moxfield OK fills candidateNames from the legal ranking and skips fetchEdhrec', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const search = vi.fn(async () => ({
      status: 200,
      numDecks: 20,
      cards: [
        { name: 'Sol Ring', inclusion: 80, count: 16 },
        { name: 'Counterspell', inclusion: 40, count: 8 },
      ],
    }));
    const fetchEdhrec = vi.fn(async () => ({
      cardlists: { allNonLand: [{ name: 'Rhystic Study' }, { name: 'Sol Ring' }] },
    }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: LEGAL,
      search,
      fetchEdhrec,
    });

    expect(result.candidateNames, 'skipping fetchEdhrec left the offer pool empty').toEqual(
      expect.arrayContaining(['Counterspell']),
    );
    expect(result.candidateNames?.every((name) => LEGAL.includes(name))).toBe(true);
    expect(result.candidateNames).not.toContain('Sol Ring');
    expect(result.candidateNames).not.toContain('Rhystic Study');
    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('moxfield');
    expect(result.popularityProviderId).toBe('moxfield');
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('brawl100 403 degrades to the legal candidate pool without blocking', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const fetchEdhrec = vi.fn(async () => ({
      cardlists: { allNonLand: [{ name: 'Rhystic Study' }] },
    }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: LEGAL,
      search: vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] })),
      fetchEdhrec,
    });

    expect(result.candidateNames?.slice().sort()).toEqual([...LEGAL].sort());
    expect(result.candidateNames).not.toContain('Rhystic Study');
    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('scryfall');
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('brawl100 5xx degrades to the legal candidate pool without blocking', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const fetchEdhrec = vi.fn(async () => ({ themes: [{ name: 'Tokens' }] }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: ['Thought Monitor'],
      search: vi.fn(async () => ({ status: 503, numDecks: 0, cards: [] })),
      fetchEdhrec,
    });

    expect(result.candidateNames).toEqual(['Thought Monitor']);
    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('scryfall');
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('brawl100 empty Moxfield payload degrades to the legal candidate pool', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const fetchEdhrec = vi.fn(async () => ({
      cardlists: { allNonLand: [{ name: 'Rhystic Study' }] },
    }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: LEGAL,
      search: vi.fn(async () => ({ status: 200, numDecks: 4, cards: [] })),
      fetchEdhrec,
    });

    expect(result.candidateNames?.slice().sort()).toEqual([...LEGAL].sort());
    expect(result.candidateNames).not.toContain('Rhystic Study');
    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('scryfall');
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('brawl100 flag off degrades to the legal candidate pool and does not search', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const search = vi.fn(async () => ({
      status: 200,
      numDecks: 9,
      cards: [{ name: 'Counterspell', inclusion: 50 }],
    }));
    const fetchEdhrec = vi.fn(async () => ({
      cardlists: { allNonLand: [{ name: 'Rhystic Study' }] },
    }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: LEGAL,
      flagEnabled: false,
      search,
      fetchEdhrec,
    });

    expect(result.candidateNames?.slice().sort()).toEqual([...LEGAL].sort());
    expect(result.blocked).toBe(false);
    expect(result.dataSource).toBe('scryfall');
    expect(search).not.toHaveBeenCalled();
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('an empty legal pool stays empty on degrade instead of falling back to EDHREC', async () => {
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const fetchEdhrec = vi.fn(async () => ({
      cardlists: { allNonLand: [{ name: 'Rhystic Study' }] },
    }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 99 },
      commanderName: 'Jace, the Mind Sculptor',
      legalCardNames: [],
      search: vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] })),
      fetchEdhrec,
    });

    expect(result.candidateNames).toEqual([]);
    expect(result.blocked).toBe(false);
    expect(fetchEdhrec).not.toHaveBeenCalled();
  });

  it('prepareBrewContext feeds brawl100 candidates from the legal Moxfield plan, not the empty EDHREC list', async () => {
    const source = await readRepoText(PREPARE_BREW_PATH);
    const body = functionBody(source, 'export async function prepareBrewContext');
    const call = brewPlanInvocation(source);
    const planSource = functionBody(
      await readRepoText('src/services/brawl/brewFormatPipeline.ts'),
      'export async function resolveBrewFormatPlan',
    );

    expect(body, 'prepareBrewContext').not.toBe('');
    expect(call, `${PREPARE_BREW_PATH} resolveBrewFormatPlan(...)`).not.toBe('');
    expect(
      /legalCardNames|buildLegalFormatPool\s*\(/.test(body),
      'prepareBrewContext never supplies a legal pool, so brawl100 offers have nothing to degrade to',
    ).toBe(true);
    expect(
      /\bcandidateNames\b|selectBrewOffers\s*\(/.test(body),
      'prepareBrewContext still builds candidates only from EDHREC allNonLand, empty because fetchEdhrec is skipped',
    ).toBe(true);
    expect(/selectBrewOffers\s*\(/.test(planSource), 'resolveBrewFormatPlan does not build offers via selectBrewOffers').toBe(true);
    expect(/status:\s*403/.test(call), 'prepareBrewContext still stubs search → 403').toBe(false);
    expect(/searchBrawl100Decks\s*\(/.test(call), 'prepareBrewContext does not call the real Moxfield search').toBe(true);
    expect(/fetchEdhrec\s*:/.test(call), 'commander EDHREC callback was removed from prepareBrewContext').toBe(true);
  });

  it('commander brew still uses the EDHREC path and does not search Moxfield', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const mod = await loadBrewModule();
    const plan = mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
    const search = vi.fn(async () => ({
      status: 200,
      numDecks: 12,
      cards: [{ name: 'Counterspell', inclusion: 40 }],
    }));
    const fetchEdhrec = vi.fn(async () => ({ themes: [{ name: 'Tokens', slug: 'tokens' }] }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'commander', deckFormat: 99 },
      commanderName: 'Atraxa, Praetors\' Voice',
      legalCardNames: LEGAL,
      search,
      fetchEdhrec,
    });

    expect(result.blocked).toBe(false);
    expect(result.formatMode).toBe('commander');
    expect(providerFor).toHaveBeenCalledWith('commander');
    expect(result.popularityProviderId).toBe('edhrec');
    expect(fetchEdhrec).toHaveBeenCalledTimes(1);
    expect(popularity).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});
