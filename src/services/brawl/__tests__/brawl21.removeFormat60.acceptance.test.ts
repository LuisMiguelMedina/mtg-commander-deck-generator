import { describe, expect, it } from 'vitest';
import * as formatMode from '@/lib/format/formatMode';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-21 acceptance (red until format 60 and standardBrawl60 leave the UI).
 * docs/pbi/PBI-BRAWL-21-remove-format60.md
 * docs/architecture/ADR-brawl-ui-followup-pr4.md
 *
 * Product slice: selectable modes are only commander | brawl100. Both are 1+99
 * via getFormatRules. standardBrawl60 is not shown (not even disabled) and is
 * not generable (`generation: 'removed'`, or absent from rules and the selector).
 *
 * Intended seams:
 *   `formatModeSelectorModel` from `src/components/customization/FormatModeSelector.tsx`
 *     options === commander | brawl100, every option selectable
 *     no standardBrawl60 entry
 *   `src/components/customization/DeckCustomizer.tsx`
 *     no 60-card chip, no handleFormatChange(60), no deckFormat: 60 write
 *   `generateDeck` in `src/services/deckBuilder/deckGenerator.ts`
 *     size comes only from getFormatRules(formatMode), not customization.deckFormat
 *   `getFormatRules('standardBrawl60')` is undefined or `{ generation: 'removed' }`
 *   `resolveBuilderFormatPipeline({ formatMode: 'standardBrawl60' })`
 *     generation === 'removed' (not 'named-only', not 'implemented')
 *
 * On 029c258 the selector still lists disabled standardBrawl60, DeckCustomizer
 * still writes deckFormat 60, generateDeck still reads customization.deckFormat,
 * and standardBrawl60 generation is still 'named-only'.
 * PBI-10/01 tests that still expect the disabled/named-only shape are left for
 * Dev to update when this goes green.
 */

const SELECTOR_MODULE = '@/components/customization/FormatModeSelector';
const PIPELINE_MODULE = '@/services/brawl/builderFormatPipeline';
const CUSTOMIZER_PATH = 'src/components/customization/DeckCustomizer.tsx';
const SELECTOR_PATH = 'src/components/customization/FormatModeSelector.tsx';
const GENERATOR_PATH = 'src/services/deckBuilder/deckGenerator.ts';

type PipelineResult = {
  blocked?: boolean;
  generation?: string;
};

describe('PBI-BRAWL-21 remove format 60 and standardBrawl60 from the product UI', () => {
  it('formatModeSelectorModel offers only selectable commander and brawl100', async () => {
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

  it('customization UI has no chip or handler that writes deckFormat 60', async () => {
    const customizer = await readRepoText(CUSTOMIZER_PATH);
    const selector = await readRepoText(SELECTOR_PATH);
    const ui = `${customizer}\n${selector}`;

    expect(/handleFormatChange\(\s*60\s*\)/.test(ui), 'DeckCustomizer still calls handleFormatChange(60)').toBe(false);
    expect(/deckFormat\s*:\s*60\b/.test(ui), 'customization UI still writes deckFormat: 60').toBe(false);
    expect(/60 Cards/.test(ui), '60 Cards chip is still rendered').toBe(false);
    expect(/standardBrawl60/.test(selector), 'FormatModeSelector still names standardBrawl60').toBe(false);
  });

  it('generateDeck takes deck size only from getFormatRules(formatMode)', async () => {
    const source = await readRepoText(GENERATOR_PATH);
    const start = source.indexOf('export async function generateDeck');
    const body = start < 0 ? '' : source.slice(start);

    const usesFormatRules = /getFormatRules\s*\(\s*formatMode\s*\)/.test(body);
    const usesChipSize = /const format = customization\.deckFormat/.test(body);

    expect(formatMode.getFormatRules('commander')?.deckSize).toBe(99);
    expect(formatMode.getFormatRules('brawl100')?.deckSize).toBe(99);
    expect(usesFormatRules, 'generateDeck sizes from getFormatRules(formatMode)').toBe(true);
    expect(usesChipSize, 'generateDeck still assigns format from customization.deckFormat').toBe(false);
  });

  it('standardBrawl60 is not a generable format mode', () => {
    const rules = formatMode.getFormatRules('standardBrawl60');

    expect(rules == null || rules.generation === 'removed').toBe(true);
    expect(rules?.generation).not.toBe('named-only');
    expect(rules?.generation).not.toBe('implemented');
  });

  it('standardBrawl60 is absent from generation (pipeline generation removed)', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const resolve = mod?.resolveBuilderFormatPipeline as ((input: {
      formatMode: string;
      commander: { name: string; type_line: string; color_identity: string[] };
      pool: unknown[];
      search: () => Promise<{ status: number }>;
      fetchEdhrecThemes: () => Promise<unknown[]>;
    }) => Promise<PipelineResult>) | undefined;

    expect(typeof resolve, `${PIPELINE_MODULE} resolveBuilderFormatPipeline`).toBe('function');
    if (typeof resolve !== 'function') return;

    let threw = false;
    let result: PipelineResult | undefined;
    try {
      result = await resolve({
        formatMode: 'standardBrawl60',
        commander: {
          name: 'Jace, the Mind Sculptor',
          type_line: 'Legendary Planeswalker — Jace',
          color_identity: ['U'],
        },
        pool: [],
        search: async () => ({ status: 200 }),
        fetchEdhrecThemes: async () => [],
      });
    } catch {
      threw = true;
    }

    expect(threw || result?.generation === 'removed').toBe(true);
    expect(result?.generation).not.toBe('named-only');
    expect(result?.generation).not.toBe('implemented');
  });
});
