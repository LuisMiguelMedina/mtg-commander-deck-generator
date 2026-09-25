import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import {
  MOXFIELD_SEARCH_URL,
  MOXFIELD_USER_AGENT,
  MOXFIELD_TIMEOUT_MS,
} from '@/services/moxfield/client';
import { searchCards } from '@/services/scryfall/client';
import { isEligibleCommander } from '@/lib/format/formatMode';
import { isLegalForFormatDeck } from '@/services/scryfall/legality';

export type SuggestionsInput = {
  formatMode: string;
  colorFilter?: string[];
  fetchEdhrecTop: () => Promise<{ name: string }[]>;
  fetchMoxfieldTop: () => Promise<{ status: number; names?: string[] }>;
  fetchScryfallTopBrawl?: (
    colorFilter?: string[],
  ) => Promise<{ names: string[]; colorIdentityByName: Record<string, string[]> }>;
  flagEnabled?: boolean;
};

export type SuggestionsResult = {
  names: string[];
  source: 'edhrec' | 'moxfield' | 'scryfall' | 'search-only';
  limitedData?: boolean;
  colorIdentityByName?: Record<string, string[]>;
};

const suggestionsCache = new Map<string, SuggestionsResult>();

export function clearCommanderSuggestionsCache(): void {
  suggestionsCache.clear();
}

type MoxfieldDeckRow = {
  commanders?: Array<{ card?: { name?: string } }>;
  commanderName?: string;
};

/** Best-effort Brawl 100 top commanders from Moxfield deck search (no EDHREC fallback). */
export async function fetchMoxfieldTopCommanders(): Promise<{ status: number; names?: string[] }> {
  const params = new URLSearchParams({
    fmt: MOXFIELD_BRAWL100_FMT,
    pageSize: '24',
    pageNumber: '1',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MOXFIELD_TIMEOUT_MS);
  try {
    const response = await fetch(`${MOXFIELD_SEARCH_URL}?${params.toString()}`, {
      headers: { 'User-Agent': MOXFIELD_USER_AGENT },
      signal: controller.signal,
    });
    const status = response.status;
    if (!response.ok) {
      return { status, names: [] };
    }
    const body = (await response.json()) as { data?: MoxfieldDeckRow[] };
    const names: string[] = [];
    for (const deck of body.data ?? []) {
      const fromList = deck.commanders?.[0]?.card?.name;
      const name = fromList ?? deck.commanderName;
      if (name) names.push(name);
    }
    return { status, names: [...new Set(names)] };
  } catch {
    return { status: 503, names: [] };
  } finally {
    clearTimeout(timeout);
  }
}

const BRAWL_TOP_LIMIT = 24;

/** Popular Arena Historic Brawl commanders from Scryfall when Moxfield top is unavailable. */
export async function fetchScryfallTopBrawlCommanders(
  colorFilter: string[] = [],
): Promise<{ names: string[]; colorIdentityByName: Record<string, string[]> }> {
  const inner =
    'game:arena legal:brawl -is:funny (is:commander OR (t:legendary t:planeswalker) OR "Legendary Artifact — Vehicle" OR "Legendary Artifact — Spacecraft")';
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
    const result: SuggestionsResult = {
      names: data.map((d) => d.name),
      source: 'edhrec',
    };
    return result;
  }

  if (formatMode === 'brawl100') {
    if (flagEnabled !== false) {
      const res = await fetchMoxfieldTop();
      if (res.status === 200 && res.names?.length) {
        return { names: res.names, source: 'moxfield' };
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
