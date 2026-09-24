import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-FOUNDRY-41 acceptance (red until suggestions switch by formatMode).
 * docs/pbi/PBI-FOUNDRY-41-suggestions-by-format.md
 *
 * At d2f2372 CommanderSearch hardcodes fetchTopCommanders / "on EDHREC" with no
 * formatMode switch. Intended seam `@/services/foundry/commanderSuggestions`
 * (or similar):
 *   suggestionsFor({ formatMode, colorFilter?, fetchEdhrecTop, fetchMoxfieldTop, flagEnabled? })
 *     => { names: string[]; source: 'edhrec'|'moxfield'|'search-only'; limitedData?: boolean }
 * - commander → EDHREC, never calls Moxfield top
 * - brawl100 Moxfield OK → moxfield names, never EDHREC
 * - brawl100 403/5xx/empty/flag off → search-only + limitedData true, names [], never EDHREC fill
 */

const SUGGESTIONS_MODULES = [
  '@/services/foundry/commanderSuggestions',
  '@/services/foundry/suggestionsFor',
] as const;
const SEARCH_PATH = 'src/components/commander/CommanderSearch.tsx';

type SuggestionsInput = {
  formatMode: string;
  colorFilter?: string[];
  fetchEdhrecTop: () => Promise<{ name: string }[]>;
  fetchMoxfieldTop: () => Promise<{ status: number; names?: string[] }>;
  flagEnabled?: boolean;
};

type SuggestionsResult = {
  names: string[];
  source: 'edhrec' | 'moxfield' | 'search-only';
  limitedData?: boolean;
};

async function loadSuggestionsFor(): Promise<
  ((input: SuggestionsInput) => Promise<SuggestionsResult>) | undefined
> {
  for (const specifier of SUGGESTIONS_MODULES) {
    const mod = await tryLoadSeam(specifier);
    const fn = (mod?.suggestionsFor ?? mod?.commanderSuggestionsFor) as
      | ((input: SuggestionsInput) => Promise<SuggestionsResult>)
      | undefined;
    if (typeof fn === 'function') return fn;
  }
  return undefined;
}

describe('PBI-FOUNDRY-41 suggestions by formatMode (EDHREC | Moxfield)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commander path uses EDHREC and never calls Moxfield top', async () => {
    const suggestionsFor = await loadSuggestionsFor();
    const fetchEdhrecTop = vi.fn(async () => [
      { name: 'Atraxa, Praetors\' Voice' },
      { name: 'Korvold, Fae-Cursed King' },
    ]);
    const fetchMoxfieldTop = vi.fn(async () => ({
      status: 200,
      names: ['Jace, the Mind Sculptor'],
    }));

    expect(typeof suggestionsFor, 'suggestionsFor seam').toBe('function');
    if (typeof suggestionsFor !== 'function') return;

    const result = await suggestionsFor({
      formatMode: 'commander',
      fetchEdhrecTop,
      fetchMoxfieldTop,
    });

    expect(result.source).toBe('edhrec');
    expect(result.names).toEqual(
      expect.arrayContaining(['Atraxa, Praetors\' Voice', 'Korvold, Fae-Cursed King']),
    );
    expect(result.names).not.toContain('Jace, the Mind Sculptor');
    expect(fetchEdhrecTop).toHaveBeenCalledTimes(1);
    expect(fetchMoxfieldTop).not.toHaveBeenCalled();
  });

  it('brawl100 Moxfield OK returns moxfield names and never calls EDHREC', async () => {
    const suggestionsFor = await loadSuggestionsFor();
    const fetchEdhrecTop = vi.fn(async () => [{ name: 'Atraxa, Praetors\' Voice' }]);
    const fetchMoxfieldTop = vi.fn(async () => ({
      status: 200,
      names: ['Jace, the Mind Sculptor', 'Teferi, Hero of Dominaria'],
    }));

    expect(typeof suggestionsFor, 'suggestionsFor seam').toBe('function');
    if (typeof suggestionsFor !== 'function') return;

    const result = await suggestionsFor({
      formatMode: 'brawl100',
      fetchEdhrecTop,
      fetchMoxfieldTop,
      flagEnabled: true,
    });

    expect(result.source).toBe('moxfield');
    expect(result.names).toEqual(
      expect.arrayContaining(['Jace, the Mind Sculptor', 'Teferi, Hero of Dominaria']),
    );
    expect(result.names).not.toContain('Atraxa, Praetors\' Voice');
    expect(fetchMoxfieldTop).toHaveBeenCalledTimes(1);
    expect(fetchEdhrecTop).not.toHaveBeenCalled();
  });

  it('brawl100 403/5xx/empty/flag-off degrades to search-only + limitedData (never EDHREC fill)', async () => {
    const suggestionsFor = await loadSuggestionsFor();

    expect(typeof suggestionsFor, 'suggestionsFor seam').toBe('function');
    if (typeof suggestionsFor !== 'function') return;

    const cases: Array<{
      label: string;
      flagEnabled?: boolean;
      fetchMoxfieldTop: () => Promise<{ status: number; names?: string[] }>;
    }> = [
      {
        label: '403',
        fetchMoxfieldTop: async () => ({ status: 403, names: [] }),
      },
      {
        label: '5xx',
        fetchMoxfieldTop: async () => ({ status: 503, names: [] }),
      },
      {
        label: 'empty',
        fetchMoxfieldTop: async () => ({ status: 200, names: [] }),
      },
      {
        label: 'flag-off',
        flagEnabled: false,
        fetchMoxfieldTop: async () => ({
          status: 200,
          names: ['Jace, the Mind Sculptor'],
        }),
      },
    ];

    for (const c of cases) {
      const fetchEdhrecTop = vi.fn(async () => [{ name: 'Atraxa, Praetors\' Voice' }]);
      const fetchMoxfieldTop = vi.fn(c.fetchMoxfieldTop);
      const result = await suggestionsFor({
        formatMode: 'brawl100',
        fetchEdhrecTop,
        fetchMoxfieldTop,
        flagEnabled: c.flagEnabled,
      });

      expect(result.source, c.label).toBe('search-only');
      expect(result.limitedData, c.label).toBe(true);
      expect(result.names, c.label).toEqual([]);
      expect(result.names, c.label).not.toContain('Atraxa, Praetors\' Voice');
      expect(fetchEdhrecTop, c.label).not.toHaveBeenCalled();
    }
  });

  it('CommanderSearch still hardcodes EDHREC top without formatMode switch (static red)', async () => {
    const source = await readRepoText(SEARCH_PATH);

    expect(
      /fetchTopCommanders/.test(source),
      'CommanderSearch still hardcodes fetchTopCommanders',
    ).toBe(true);
    expect(
      /on EDHREC/.test(source),
      'CommanderSearch still shows on EDHREC copy',
    ).toBe(true);
    expect(
      /formatMode/.test(source),
      'CommanderSearch has no formatMode switch for suggestions',
    ).toBe(true);
    expect(
      /suggestionsFor\s*\(/.test(source),
      'CommanderSearch does not call suggestionsFor seam',
    ).toBe(true);
  });
});
