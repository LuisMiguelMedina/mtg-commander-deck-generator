import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-FOUNDRY-42 acceptance (red until format change resets + store sync).
 * docs/pbi/PBI-FOUNDRY-42-format-change-reset-sync.md
 *
 * At d2f2372 there is no reset-on-format-change helper; HomePage never writes
 * formatMode. Intended:
 * - setLandingFormatMode(mode) (or store action) clears selected commander +
 *   cached suggestions when formatMode changes
 * - formatMode from landing is the same store field generate/brew/DeckCustomizer read
 * - commander path still uses EDHREC suggestions when formatMode===commander
 */

const RESET_MODULES = [
  '@/services/foundry/landingFormat',
  '@/pages/HomePage',
  '@/store',
] as const;
const HOME_PATH = 'src/pages/HomePage.tsx';
const SEARCH_PATH = 'src/components/commander/CommanderSearch.tsx';

type ResetFn = (mode: string) => void | Promise<void>;

const pristine = { ...useStore.getState().customization };
const pristineCommander = useStore.getState().commander;

async function loadSetLandingFormatMode(): Promise<ResetFn | undefined> {
  for (const specifier of RESET_MODULES) {
    const mod = await tryLoadSeam(specifier);
    const fn = (mod?.setLandingFormatMode ??
      mod?.resetOnFormatChange ??
      mod?.setFormatModeAndReset) as ResetFn | undefined;
    if (typeof fn === 'function') return fn;
  }
  return undefined;
}

describe('PBI-FOUNDRY-42 format change reset + store sync + commander regression', () => {
  beforeEach(() => {
    useStore.setState({
      customization: { ...pristine, formatMode: 'commander' },
      commander: pristineCommander,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState({
      customization: { ...pristine },
      commander: pristineCommander,
    });
  });

  it('setLandingFormatMode clears selected commander when formatMode changes', async () => {
    const setMode = await loadSetLandingFormatMode();
    const fakeCommander = {
      id: 'fake-cmd',
      name: "Atraxa, Praetors' Voice",
      type_line: 'Legendary Creature — Phyrexian Angel Horror',
      color_identity: ['W', 'U', 'B', 'G'],
    };
    // Minimal stand-in card for red seam; store typing is ScryfallCard.
    useStore.getState().setCommander(fakeCommander as never);
    expect(useStore.getState().commander).toBeTruthy();

    expect(typeof setMode, 'setLandingFormatMode seam').toBe('function');
    if (typeof setMode !== 'function') return;

    await setMode('brawl100');
    expect(useStore.getState().customization.formatMode).toBe('brawl100');
    expect(useStore.getState().commander).toBeNull();
  });

  it('formatMode written by landing is the same field DeckCustomizer/generate read', async () => {
    const setMode = await loadSetLandingFormatMode();

    expect(typeof setMode, 'setLandingFormatMode seam').toBe('function');
    if (typeof setMode !== 'function') return;

    await setMode('brawl100');
    expect(useStore.getState().customization.formatMode).toBe('brawl100');

    await setMode('commander');
    expect(useStore.getState().customization.formatMode).toBe('commander');
  });

  it('commander path still wires EDHREC suggestions (regression static)', async () => {
    const search = await readRepoText(SEARCH_PATH);

    expect(/fetchTopCommanders/.test(search)).toBe(true);
    expect(/on EDHREC/.test(search)).toBe(true);

    // After green: suggestionsFor('commander') must remain EDHREC — seam contract.
    const mod =
      (await tryLoadSeam('@/services/foundry/commanderSuggestions')) ??
      (await tryLoadSeam('@/services/foundry/suggestionsFor'));
    const suggestionsFor = (mod?.suggestionsFor ?? mod?.commanderSuggestionsFor) as
      | ((input: {
          formatMode: string;
          fetchEdhrecTop: () => Promise<{ name: string }[]>;
          fetchMoxfieldTop: () => Promise<{ status: number; names?: string[] }>;
        }) => Promise<{ source: string; names: string[] }>)
      | undefined;

    expect(typeof suggestionsFor, 'suggestionsFor for commander regression').toBe('function');
    if (typeof suggestionsFor !== 'function') return;

    const fetchEdhrecTop = vi.fn(async () => [{ name: 'Atraxa, Praetors\' Voice' }]);
    const fetchMoxfieldTop = vi.fn(async () => ({ status: 200, names: ['Jace'] }));
    const result = await suggestionsFor({
      formatMode: 'commander',
      fetchEdhrecTop,
      fetchMoxfieldTop,
    });
    expect(result.source).toBe('edhrec');
    expect(fetchMoxfieldTop).not.toHaveBeenCalled();
  });

  it('HomePage never writes formatMode / no reset-on-format-change helper (static red)', async () => {
    const home = await readRepoText(HOME_PATH);

    expect(
      /formatMode/.test(home),
      'HomePage never writes formatMode today',
    ).toBe(true);
    expect(
      /setLandingFormatMode|resetOnFormatChange|setFormatModeAndReset/.test(home),
      'HomePage has no reset-on-format-change helper',
    ).toBe(true);
  });
});
