import { afterEach, describe, expect, it, vi } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import * as provider from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-12 acceptance (red until Brew follows FormatMode).
 * docs/pbi/PBI-BRAWL-12-brew-wiring.md
 * docs/architecture/ADR-brawl-ui-wiring.md
 *
 * Reuses getFormatRules, popularityProviderFor, getBrawl100Popularity,
 * and MOXFIELD_POPULARITY_ENABLED_DEFAULT.
 *
 * Intended seam: `resolveBrewFormatPlan` from
 * `src/services/brawl/brewFormatPipeline.ts`.
 * prepareBrewContext, finishBrew, and the BrewPage EDHREC load must read
 * customization.formatMode (not a hardcoded EDHREC/commander path, and not
 * the deckFormat 60|99 chip).
 *
 *   resolveBrewFormatPlan({
 *     customization: { formatMode, deckFormat },
 *     commanderName, search, fetchEdhrec,
 *   }) => {
 *     blocked, generation, formatMode, popularityProviderId,
 *     deckSize, legalityMode, dataSource,
 *   }
 *
 * brawl100 uses the Brawl popularity port (flag ON, 403 → dataSource scryfall)
 * and getFormatRules('brawl100') for deck size / legality mode.
 * commander keeps the EDHREC fetch.
 * standardBrawl60 does not generate.
 *
 * Today prepareBrewContext and BrewPage always fetch EDHREC, and finishBrew
 * forwards customization.deckFormat into generateDeck.
 */

const BREW_PIPELINE_MODULE = '@/services/brawl/brewFormatPipeline';

type BrewPlanInput = {
  customization: { formatMode?: string; deckFormat: number };
  commanderName: string;
  search: () => Promise<{ status: number; numDecks?: number; cards?: unknown[] }>;
  fetchEdhrec: () => Promise<unknown>;
};

type BrewPlan = {
  blocked?: boolean;
  generation?: string;
  formatMode?: string;
  popularityProviderId?: string;
  deckSize?: number;
  legalityMode?: string;
  dataSource?: string;
};

async function loadPlan(): Promise<((input: BrewPlanInput) => Promise<BrewPlan>) | undefined> {
  const mod = await tryLoadSeam(BREW_PIPELINE_MODULE);
  return mod?.resolveBrewFormatPlan as ((input: BrewPlanInput) => Promise<BrewPlan>) | undefined;
}

describe('PBI-BRAWL-12 Brew FormatMode wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('brawl100 brew uses the Brawl popularity port and brawl100 rules, not the size chip', async () => {
    const expectedSize = formatMode.getFormatRules('brawl100')?.deckSize;
    const rules = vi.spyOn(formatMode, 'getFormatRules');
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const plan = await loadPlan();
    const search = vi.fn(async () => ({ status: 403, numDecks: 0, cards: [] }));
    const fetchEdhrec = vi.fn(async () => ({ themes: [{ name: 'Tokens' }] }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'brawl100', deckFormat: 60 },
      commanderName: 'Ragavan, Nimble Pilferer',
      search,
      fetchEdhrec,
    });

    expect(result.blocked).toBe(false);
    expect(result.generation).toBe('implemented');
    expect(result.formatMode).toBe('brawl100');
    expect(rules).toHaveBeenCalledWith('brawl100');
    expect(result.deckSize).toBe(expectedSize);
    expect(result.legalityMode).toBe('brawl100');
    expect(providerFor).toHaveBeenCalledWith('brawl100');
    expect(result.popularityProviderId).toBe('moxfield');
    expect(popularity).toHaveBeenCalledWith(expect.objectContaining({
      commanderName: 'Ragavan, Nimble Pilferer',
      flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
    }));
    expect(MOXFIELD_POPULARITY_ENABLED_DEFAULT).toBe(true);
    expect(search).toHaveBeenCalled();
    expect(fetchEdhrec).not.toHaveBeenCalled();
    expect(result.dataSource).toBe('scryfall');
  });

  it('commander brew keeps the EDHREC popularity path', async () => {
    const expectedSize = formatMode.getFormatRules('commander')?.deckSize;
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const providerFor = vi.spyOn(provider, 'popularityProviderFor');
    const plan = await loadPlan();
    const search = vi.fn(async () => ({ status: 200, numDecks: 12, cards: [] }));
    const fetchEdhrec = vi.fn(async () => ({ themes: [{ name: 'Tokens', slug: 'tokens' }] }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    const result = await plan({
      customization: { formatMode: 'commander', deckFormat: 60 },
      commanderName: 'Atraxa, Praetors\' Voice',
      search,
      fetchEdhrec,
    });

    expect(result.blocked).toBe(false);
    expect(result.generation).toBe('implemented');
    expect(result.formatMode).toBe('commander');
    expect(result.deckSize).toBe(expectedSize);
    expect(result.legalityMode).toBe('commander');
    expect(providerFor).toHaveBeenCalledWith('commander');
    expect(result.popularityProviderId).toBe('edhrec');
    expect(fetchEdhrec).toHaveBeenCalledTimes(1);
    expect(popularity).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('standardBrawl60 does not start or finish a brew generate', async () => {
    const popularity = vi.spyOn(provider, 'getBrawl100Popularity');
    const plan = await loadPlan();
    const search = vi.fn(async () => ({ status: 200, numDecks: 4, cards: [] }));
    const fetchEdhrec = vi.fn(async () => ({ themes: [] }));

    expect(typeof plan, `${BREW_PIPELINE_MODULE} resolveBrewFormatPlan`).toBe('function');
    if (typeof plan !== 'function') return;

    let threw = false;
    let result: BrewPlan | undefined;
    try {
      result = await plan({
        customization: { formatMode: 'standardBrawl60', deckFormat: 60 },
        commanderName: 'Ragavan, Nimble Pilferer',
        search,
        fetchEdhrec,
      });
    } catch {
      threw = true;
    }

    expect(threw || result?.blocked === true || result?.generation === 'named-only').toBe(true);
    expect(search).not.toHaveBeenCalled();
    expect(fetchEdhrec).not.toHaveBeenCalled();
    expect(popularity).not.toHaveBeenCalled();
  });

  it('prepareBrewContext reads formatMode', async () => {
    const source = await readRepoText('src/services/brew/prepareBrewContext.ts');
    expect(/\bformatMode\b/.test(source), 'prepareBrewContext reads formatMode').toBe(true);
  });

  it('finishBrew reads formatMode', async () => {
    const source = await readRepoText('src/services/brew/finishBrew.ts');
    expect(/\bformatMode\b/.test(source), 'finishBrew reads formatMode').toBe(true);
  });

  it('BrewPage EDHREC load branches on formatMode', async () => {
    const source = await readRepoText('src/pages/BrewPage.tsx');
    expect(/\bformatMode\b/.test(source), 'BrewPage EDHREC load reads formatMode').toBe(true);
  });
});
