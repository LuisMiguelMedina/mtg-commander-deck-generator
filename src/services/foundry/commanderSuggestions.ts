import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import { fetchBrawlTopCommandersProxied } from '@/services/brawl/fetchBrawlTopCommanders';
import { searchCards } from '@/services/scryfall/client';
import { BRAWL_ARENA_COMMANDER_SCRYFALL_QUERY, isEligibleCommander } from '@/lib/format/formatMode';
import { isLegalForFormatDeck } from '@/services/scryfall/legality';

export type SuggestionsInput = {
  formatMode: string;
  colorFilter?: string[];
  fetchEdhrecTop: () => Promise<{ name: string }[]>;
  fetchMoxfieldTop: () => Promise<{ status: number; names?: string[]; source?: 'moxfield' | 'archidekt' }>;
  fetchScryfallTopBrawl?: (
    colorFilter?: string[],
  ) => Promise<{ names: string[]; colorIdentityByName: Record<string, string[]> }>;
  flagEnabled?: boolean;
};

export type SuggestionsResult = {
  names: string[];
  source: 'edhrec' | 'moxfield' | 'archidekt' | 'scryfall' | 'search-only';
  limitedData?: boolean;
  colorIdentityByName?: Record<string, string[]>;
};

const suggestionsCache = new Map<string, SuggestionsResult>();

export function clearCommanderSuggestionsCache(): void {
  suggestionsCache.clear();
}

/** Top Historic Brawl commanders via analytics proxy (Moxfield → Archidekt). */
export async function fetchMoxfieldTopCommanders(): Promise<{
  status: number;
  names?: string[];
  source?: 'moxfield' | 'archidekt';
}> {
  const result = await fetchBrawlTopCommandersProxied();
  return {
    status: result.status,
    names: result.names,
    source: result.source === 'archidekt' || result.source === 'moxfield' ? result.source : undefined,
  };
}

const BRAWL_TOP_LIMIT = 24;

/** Popular Arena Historic Brawl commanders from Scryfall when community lists are unavailable. */
export async function fetchScryfallTopBrawlCommanders(
  colorFilter: string[] = [],
): Promise<{ names: string[]; colorIdentityByName: Record<string, string[]> }> {
  const inner = BRAWL_ARENA_COMMANDER_SCRYFALL_QUERY;
  const response = await searchCards(inner, colorFilter, { order: 'edhrec', skipFormatFilter: true });
  const names: string[] = [];
  const colorIdentityByName: Record<string, string[]> = {};
  for (const card of response.data) {
    if (!isEligibleCommander(card, 'brawl100')) continue;
    if (!isLegalForFormatDeck(card, 'brawl100')) continue;
    names.push(card.name);
    colorIdentityByName[card.name] = card.color_identity ?? [];
    if (names.length >= BRAWL_TOP_LIMIT) break;
  }
  return { names, colorIdentityByName };
}

export async function suggestionsFor(input: SuggestionsInput): Promise<SuggestionsResult> {
  const {
    formatMode,
    colorFilter = [],
    fetchEdhrecTop,
    fetchMoxfieldTop,
    fetchScryfallTopBrawl = fetchScryfallTopBrawlCommanders,
    flagEnabled = true,
  } = input;

  if (formatMode === 'commander') {
    const data = await fetchEdhrecTop();
    return {
      names: data.map((d) => d.name),
      source: 'edhrec',
    };
  }

  if (formatMode === 'brawl100') {
    if (flagEnabled !== false) {
      const res = await fetchMoxfieldTop();
      if (res.status === 200 && res.names?.length) {
        const source = res.source === 'archidekt' ? 'archidekt' : 'moxfield';
        return {
          names: res.names,
          source,
          limitedData: source === 'archidekt',
        };
      }
    }
    const scryfall = await fetchScryfallTopBrawl(colorFilter);
    if (scryfall.names.length) {
      return {
        names: scryfall.names,
        source: 'scryfall',
        limitedData: true,
        colorIdentityByName: scryfall.colorIdentityByName,
      };
    }
    return { names: [], source: 'search-only', limitedData: true };
  }

  return { names: [], source: 'search-only', limitedData: true };
}

// re-export for tests / fmt reference
export { MOXFIELD_BRAWL100_FMT };
