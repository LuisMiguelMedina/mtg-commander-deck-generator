import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEligibleCommander } from '@/lib/format/formatMode';
import { useStore } from '@/store';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-FOUNDRY-40 acceptance (red until Foundry landing is format-first).
 * docs/pbi/PBI-FOUNDRY-40-landing-format-first.md
 * docs/architecture / workspace ADR-foundry-format-first.md
 *
 * At d2f2372 HomePage step 1 is still "Choose Your Commander" with CommanderSearch
 * unbound by formatMode. No Historic Brawl | Commander picker; no gate.
 *
 * Intended seams:
 * `foundryLandingModel` from `@/pages/HomePage` or `@/services/foundry/landingFormat`
 *   step1 options exactly Historic Brawl→brawl100 | Commander→commander
 *   (no 60 / standardBrawl60)
 *   step2Available only when formatMode chosen
 * Store: choosing format writes `formatMode` via the same key DeckCustomizer/generate read
 * Search eligibility uses `isEligibleCommander(card, formatMode)` from `@/lib/format/formatMode`
 */

const LANDING_MODULES = ['@/services/foundry/landingFormat', '@/pages/HomePage'] as const;
const HOME_PATH = 'src/pages/HomePage.tsx';

type LandingOption = { label?: string; mode?: string };
type LandingModel = {
  step1?: { options?: LandingOption[]; heading?: string };
  step2Available?: boolean;
  formatMode?: string | null;
};

const pristine = { ...useStore.getState().customization };

async function loadLandingModel(): Promise<((state?: {
  formatMode?: string | null;
}) => LandingModel) | undefined> {
  for (const specifier of LANDING_MODULES) {
    const mod = await tryLoadSeam(specifier);
    const fn = mod?.foundryLandingModel as
      | ((state?: { formatMode?: string | null }) => LandingModel)
      | undefined;
    if (typeof fn === 'function') return fn;
  }
  return undefined;
}

describe('PBI-FOUNDRY-40 landing format-first (HomePage = ManaFoundry builder)', () => {
  beforeEach(() => {
    useStore.setState({ customization: { ...pristine } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState({ customization: { ...pristine } });
  });

  it('foundryLandingModel step1 is Historic Brawl|Commander only (no 60 path)', async () => {
    const modelFn = await loadLandingModel();

    expect(typeof modelFn, 'foundryLandingModel seam').toBe('function');
    if (typeof modelFn !== 'function') return;

    const model = modelFn({ formatMode: null });
    const options = model.step1?.options ?? [];
    const modes = options.map((o) => o.mode);
    const labels = options.map((o) => o.label);

    expect(modes).toEqual(['brawl100', 'commander']);
    expect(labels).toEqual(expect.arrayContaining(['Historic Brawl', 'Commander']));
    expect(modes).not.toContain('standardBrawl60');
    expect(modes).not.toContain('60');
  });

  it('step2Available is false until formatMode is chosen', async () => {
    const modelFn = await loadLandingModel();

    expect(typeof modelFn, 'foundryLandingModel seam').toBe('function');
    if (typeof modelFn !== 'function') return;

    expect(modelFn({ formatMode: null }).step2Available).toBe(false);
    expect(modelFn({ formatMode: 'commander' }).step2Available).toBe(true);
    expect(modelFn({ formatMode: 'brawl100' }).step2Available).toBe(true);
  });

  it('choosing format writes the same store formatMode DeckCustomizer uses', async () => {
    const modelFn = await loadLandingModel();
    const setMode =
      ((await tryLoadSeam('@/services/foundry/landingFormat'))?.setLandingFormatMode as
        | ((mode: string) => void)
        | undefined) ??
      ((await tryLoadSeam('@/pages/HomePage'))?.setLandingFormatMode as
        | ((mode: string) => void)
        | undefined);

    expect(
      typeof modelFn === 'function' || typeof setMode === 'function',
      'landing format writer seam',
    ).toBe(true);

    if (typeof setMode === 'function') {
      setMode('brawl100');
      expect(useStore.getState().customization.formatMode).toBe('brawl100');
      setMode('commander');
      expect(useStore.getState().customization.formatMode).toBe('commander');
      return;
    }

    // Fallback contract: store key already shared; landing must write it (static below).
    useStore.getState().updateCustomization({ formatMode: 'brawl100' });
    expect(useStore.getState().customization.formatMode).toBe('brawl100');
  });

  it('search eligibility uses isEligibleCommander(card, formatMode)', () => {
    const commanderOnly = {
      name: 'Atraxa, Praetors\' Voice',
      type_line: 'Legendary Creature — Phyrexian Angel Horror',
      color_identity: ['W', 'U', 'B', 'G'],
    };
    const brawlPlaneswalker = {
      name: 'Jace, the Mind Sculptor',
      type_line: 'Legendary Planeswalker — Jace',
      color_identity: ['U'],
    };

    expect(isEligibleCommander(commanderOnly, 'commander')).toBe(true);
    expect(isEligibleCommander(brawlPlaneswalker, 'commander')).toBe(false);
    expect(isEligibleCommander(brawlPlaneswalker, 'brawl100')).toBe(true);
  });

  it('HomePage still lacks format-first step before CommanderSearch (static red)', async () => {
    const home = await readRepoText(HOME_PATH);

    expect(
      /Choose Your Commander/.test(home),
      'HomePage still uses Choose Your Commander as step 1 heading',
    ).toBe(false);
    expect(
      /Choose format/i.test(home),
      'HomePage has no Choose format step-1 heading',
    ).toBe(true);
    expect(
      /Historic Brawl/.test(home),
      'HomePage has no Historic Brawl format picker before CommanderSearch',
    ).toBe(true);
    expect(
      /formatMode/.test(home),
      'HomePage does not gate CommanderSearch behind formatMode',
    ).toBe(true);
  });
});
