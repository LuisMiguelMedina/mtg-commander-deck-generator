import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import { useStore } from '@/store';
import type { Customization } from '@/types';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-30 acceptance (red until formatMode is only a 1+99 switch).
 * docs/pbi/PBI-BRAWL-30-formatmode-switch-only.md
 * docs/architecture/ADR-brawl-residuales-pr5.md
 *
 * Product principle: commander and brawl100 share generate/store/scorer.
 * formatMode only switches the Scryfall legal pool and the popularity provider.
 * Deck size is always getFormatRules(formatMode).deckSize (1+99). Zero custom
 * size. Zero deckFormat 60 path.
 *
 * Intended seams:
 *   `formatModeSelectorModel` from `src/components/customization/FormatModeSelector.tsx`
 *     options === commander | brawl100 only
 *   `src/components/customization/DeckCustomizer.tsx`
 *     no custom-size editor, no handleFormatChange that writes an arbitrary deckFormat
 *   store `updateCustomization` in `src/store/index.ts`
 *     a free deckFormat write (60, 40, …) does not stick; effective size stays
 *     getFormatRules(current formatMode).deckSize
 *   `hydrateCustomization` from `src/store/index.ts`  (red contract — not exported yet)
 *     hydrateCustomization({ formatMode?, deckFormat }) => { formatMode, deckFormat }
 *     formatMode commander|brawl100 is kept; missing formatMode → 'commander'
 *     deckFormat is always getFormatRules(resolvedMode).deckSize
 *     legacy deckFormat 60 (and any other free size) hydrates to 99
 *   `calculateTargetCounts` in `src/services/deckBuilder/deckGenerator.ts`
 *     sizes from getFormatRules(formatMode), not customization.deckFormat
 *     no free-format table (knownDefaults[format], including the 60 composition)
 *   `generateDeck` in the same file
 *     size already comes from getFormatRules(formatMode).deckSize
 *   brew `prepareBrewContext` / `finishBrew`
 *     size from getFormatRules(formatMode), not customization.deckFormat
 *     finishBrew applies that size for every mode, not only the brawl100 branch
 *
 * On 44bd898 the selector is already commander|brawl100 and generateDeck already
 * reads getFormatRules, but DeckCustomizer still commits an arbitrary custom size,
 * the store still keeps a bare deckFormat: 60 write, nothing hydrates legacy 60,
 * calculateTargetCounts still reads customization.deckFormat, and brew still
 * falls back to that chip (finishBrew only overrides brawl100).
 * PBI-01/10/20/21 suites that still tolerate a deckFormat 60 write are left for
 * Dev to clean up when this goes green.
 */

const SELECTOR_MODULE = '@/components/customization/FormatModeSelector';
const STORE_MODULE = '@/store';
const CUSTOMIZER_PATH = 'src/components/customization/DeckCustomizer.tsx';
const GENERATOR_PATH = 'src/services/deckBuilder/deckGenerator.ts';
const PREPARE_BREW_PATH = 'src/services/brew/prepareBrewContext.ts';
const FINISH_BREW_PATH = 'src/services/brew/finishBrew.ts';

type WithFormatMode = { formatMode?: string; deckFormat: number };

type HydratedCustomization = { formatMode: string; deckFormat: number };

const pristine = { ...useStore.getState().customization };

function readCustomization(): WithFormatMode {
  return useStore.getState().customization as WithFormatMode;
}

function updateCustomization(partial: Partial<WithFormatMode>): void {
  useStore.getState().updateCustomization(partial as Partial<Customization>);
}

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return '';
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + signature.length + next);
}

describe('PBI-BRAWL-30 formatMode only switches a fixed 1+99 size', () => {
  beforeEach(() => {
    useStore.setState({ customization: { ...pristine } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState({ customization: { ...pristine } });
  });

  it('formatModeSelectorModel offers only commander and brawl100', async () => {
    const mod = await tryLoadSeam(SELECTOR_MODULE);
    const modelFn = mod?.formatModeSelectorModel as (() => {
      options?: Array<{ mode?: string; selectable?: boolean }>;
    }) | undefined;

    expect(typeof modelFn, `${SELECTOR_MODULE} formatModeSelectorModel`).toBe('function');
    if (typeof modelFn !== 'function') return;

    const model = modelFn();
    const modes = (model.options ?? []).map((option) => option.mode);

    expect(modes).toEqual(['commander', 'brawl100']);
    expect(modes).not.toContain('standardBrawl60');
    expect((model.options ?? []).every((option) => option.selectable === true)).toBe(true);
  });

  it('customization UI has no custom size control or handleFormatChange that writes an arbitrary deckFormat', async () => {
    const customizer = await readRepoText(CUSTOMIZER_PATH);

    expect(
      /customFormatValue|commitCustomFormat|startEditingCustomFormat/.test(customizer),
      'DeckCustomizer still edits a free custom deck size',
    ).toBe(false);
    expect(
      /handleFormatChange/.test(customizer),
      'DeckCustomizer still has handleFormatChange writing deckFormat',
    ).toBe(false);
    expect(
      /deckFormat:\s*format\b/.test(customizer),
      'DeckCustomizer still assigns an arbitrary deckFormat',
    ).toBe(false);
  });

  it('a free deckFormat write does not override getFormatRules(formatMode).deckSize', () => {
    const commanderSize = formatMode.getFormatRules('commander')?.deckSize;
    const brawlSize = formatMode.getFormatRules('brawl100')?.deckSize;

    updateCustomization({ formatMode: 'commander' });
    updateCustomization({ deckFormat: 60 });

    expect(readCustomization().formatMode).toBe('commander');
    expect(readCustomization().deckFormat).toBe(commanderSize);
    expect(commanderSize).toBe(99);

    updateCustomization({ formatMode: 'brawl100' });
    updateCustomization({ deckFormat: 40 });

    expect(readCustomization().formatMode).toBe('brawl100');
    expect(readCustomization().deckFormat).toBe(brawlSize);
    expect(brawlSize).toBe(99);
  });

  it('hydrateCustomization maps legacy deckFormat 60 onto getFormatRules size', async () => {
    const mod = await tryLoadSeam(STORE_MODULE);
    const hydrate = mod?.hydrateCustomization as ((input: {
      formatMode?: string;
      deckFormat?: number;
    }) => HydratedCustomization) | undefined;

    expect(typeof hydrate, `${STORE_MODULE} hydrateCustomization`).toBe('function');
    if (typeof hydrate !== 'function') return;

    const commander = hydrate({ formatMode: 'commander', deckFormat: 60 });
    const brawl = hydrate({ formatMode: 'brawl100', deckFormat: 60 });
    const missingMode = hydrate({ deckFormat: 40 });

    expect(commander).toEqual({
      formatMode: 'commander',
      deckFormat: formatMode.getFormatRules('commander')?.deckSize,
    });
    expect(brawl.formatMode).toBe('brawl100');
    expect(brawl.deckFormat).toBe(formatMode.getFormatRules('brawl100')?.deckSize);
    expect(missingMode).toEqual({ formatMode: 'commander', deckFormat: 99 });
    expect(commander.deckFormat).toBe(99);
    expect(brawl.deckFormat).toBe(99);
  });

  it('calculateTargetCounts sizes from getFormatRules, not a free deckFormat', async () => {
    const source = await readRepoText(GENERATOR_PATH);
    const body = functionBody(source, 'function calculateTargetCounts');

    expect(body, 'calculateTargetCounts').not.toBe('');
    expect(body, 'calculateTargetCounts sizes from getFormatRules').toMatch(/getFormatRules\s*\(/);
    expect(body, 'calculateTargetCounts still reads customization.deckFormat').not.toMatch(
      /customization\.deckFormat/,
    );
    expect(body, 'calculateTargetCounts still indexes a free-size table').not.toMatch(
      /knownDefaults\s*\[\s*format\s*\]/,
    );
    expect(body, 'calculateTargetCounts still has a deckFormat 60 composition').not.toMatch(/\b60\s*:/);
  });

  it('generateDeck takes deck size only from getFormatRules(formatMode)', async () => {
    const source = await readRepoText(GENERATOR_PATH);
    const body = functionBody(source, 'export async function generateDeck');

    expect(formatMode.getFormatRules('commander')?.deckSize).toBe(99);
    expect(formatMode.getFormatRules('brawl100')?.deckSize).toBe(99);
    expect(body, 'generateDeck sizes from getFormatRules(formatMode)').toMatch(
      /getFormatRules\s*\(\s*formatMode\s*\)/,
    );
    expect(body, 'generateDeck still assigns format from customization.deckFormat').not.toMatch(
      /const format = customization\.deckFormat/,
    );
  });

  it('brew sizing uses getFormatRules(formatMode), not customization.deckFormat', async () => {
    const prepare = functionBody(
      await readRepoText(PREPARE_BREW_PATH),
      'export async function prepareBrewContext',
    );
    const finish = functionBody(
      await readRepoText(FINISH_BREW_PATH),
      'export async function finishBrew',
    );

    expect(prepare, 'prepareBrewContext').not.toBe('');
    expect(prepare, 'prepareBrewContext sizes from getFormatRules(formatMode)').toMatch(
      /getFormatRules\s*\(\s*formatMode\s*\)/,
    );
    expect(prepare, 'prepareBrewContext still falls back to customization.deckFormat').not.toMatch(
      /customization\.deckFormat/,
    );

    expect(finish, 'finishBrew').not.toBe('');
    expect(finish, 'finishBrew sizes every mode from getFormatRules(formatMode)').toMatch(
      /getFormatRules\s*\(\s*formatMode\s*\)/,
    );
    expect(finish, 'finishBrew still special-cases only brawl100 deck size').not.toMatch(
      /formatMode === 'brawl100' \? getFormatRules\('brawl100'\)/,
    );
  });
});
