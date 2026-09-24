import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import { useStore } from '@/store';
import type { Customization } from '@/types';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-10 acceptance (red until FormatMode is stored and selectable).
 * docs/pbi/PBI-BRAWL-10-formatmode-selector-store.md
 * docs/architecture/ADR-brawl-ui-wiring.md
 *
 * Reuses `getFormatRules` from `src/lib/format/formatMode.ts`. Does not map the
 * deck-size chip (`deckFormat` 60|99) onto FormatMode.
 *
 * Intended seams:
 *   store `customization.formatMode` via `useStore` / `updateCustomization`
 *     default `'commander'`
 *     setting an implemented mode sets `deckFormat = getFormatRules(mode).deckSize`
 *     `updateCustomization({ deckFormat: 60 })` does not write FormatMode
 *   `formatModeSelectorModel` from `src/components/customization/FormatModeSelector.tsx`
 *     selectable: commander | brawl100
 *     standardBrawl60 present and not selectable
 *     `brawl100LifeCopy === getFormatRules('brawl100').lifeCopy`
 *     mounted by `DeckCustomizer` (BuilderPage and BrewSetup already render it)
 *   `DeckDataSource` in `src/types/index.ts` includes `'moxfield'`
 *
 * Today Customization has no formatMode, DeckCustomizer keys format by the
 * 60|99 chip, and DeckDataSource stops at scryfall.
 */

const SELECTOR_MODULE = '@/components/customization/FormatModeSelector';
const TYPES_PATH = 'src/types/index.ts';

type WithFormatMode = { formatMode?: string; deckFormat: number };

const pristine = { ...useStore.getState().customization };

function readCustomization(): WithFormatMode {
  return useStore.getState().customization as WithFormatMode;
}

function updateCustomization(partial: Partial<WithFormatMode>): void {
  useStore.getState().updateCustomization(partial as Partial<Customization>);
}

function deckDataSourceMembers(source: string): string[] {
  const match = source.match(/export type DeckDataSource\s*=([\s\S]*?);/);
  if (!match) return [];
  const body = match[1].replace(/\/\/.*$/gm, '');
  return [...body.matchAll(/'([^']+)'/g)].map((hit) => hit[1]);
}

describe('PBI-BRAWL-10 FormatMode store + selector', () => {
  beforeEach(() => {
    useStore.setState({ customization: { ...pristine } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults customization.formatMode to commander', () => {
    expect(readCustomization().formatMode).toBe('commander');
  });

  it('setting formatMode to brawl100 syncs deckFormat from getFormatRules', () => {
    const expectedSize = formatMode.getFormatRules('brawl100')?.deckSize;
    const rules = vi.spyOn(formatMode, 'getFormatRules');

    updateCustomization({ deckFormat: 60 });
    updateCustomization({ formatMode: 'brawl100' });

    expect(readCustomization().formatMode).toBe('brawl100');
    expect(readCustomization().deckFormat).toBe(expectedSize);
    expect(rules).toHaveBeenCalledWith('brawl100');
  });

  it('setting formatMode to commander syncs deckFormat from getFormatRules', () => {
    const expectedSize = formatMode.getFormatRules('commander')?.deckSize;
    const rules = vi.spyOn(formatMode, 'getFormatRules');

    updateCustomization({ deckFormat: 60 });
    updateCustomization({ formatMode: 'commander' });

    expect(readCustomization().formatMode).toBe('commander');
    expect(readCustomization().deckFormat).toBe(expectedSize);
    expect(rules).toHaveBeenCalledWith('commander');
  });

  it('changing the deckFormat 60 chip does not select standardBrawl60', async () => {
    updateCustomization({ deckFormat: 60 });

    expect(readCustomization().formatMode).toBe('commander');
    expect(readCustomization().formatMode).not.toBe('standardBrawl60');

    const storeSrc = await readRepoText('src/store/index.ts');
    const customizerSrc = await readRepoText('src/components/customization/DeckCustomizer.tsx');
    expect(`${storeSrc}\n${customizerSrc}`).not.toMatch(
      /deckFormat\s*===?\s*60[\s\S]{0,120}standardBrawl60/,
    );
  });

  it('FormatModeSelector offers commander and brawl100, names standardBrawl60, and is mounted', async () => {
    const mod = await tryLoadSeam(SELECTOR_MODULE);
    const modelFn = mod?.formatModeSelectorModel as (() => {
      options?: Array<{ mode?: string; selectable?: boolean }>;
      brawl100LifeCopy?: string;
    }) | undefined;

    expect(typeof modelFn, `${SELECTOR_MODULE} formatModeSelectorModel`).toBe('function');
    if (typeof modelFn !== 'function') return;

    const model = modelFn();
    const selectable = (model.options ?? [])
      .filter((option) => option.selectable)
      .map((option) => option.mode)
      .sort();
    const namedOnly = (model.options ?? []).find((option) => option.mode === 'standardBrawl60');

    expect(selectable).toEqual(['brawl100', 'commander']);
    expect(namedOnly).toBeDefined();
    expect(namedOnly?.selectable).toBe(false);
    expect(model.brawl100LifeCopy).toBe(formatMode.getFormatRules('brawl100')?.lifeCopy);

    const customizer = await readRepoText('src/components/customization/DeckCustomizer.tsx');
    expect(customizer).toMatch(/FormatModeSelector/);
  });

  it('DeckDataSource union includes moxfield', async () => {
    const members = deckDataSourceMembers(await readRepoText(TYPES_PATH));

    expect(members, TYPES_PATH).toEqual(
      expect.arrayContaining(['theme+bracket', 'theme', 'base+bracket', 'base', 'scryfall', 'moxfield']),
    );
  });
});
