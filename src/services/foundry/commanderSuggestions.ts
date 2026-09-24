import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import {
  MOXFIELD_SEARCH_URL,
  MOXFIELD_USER_AGENT,
  MOXFIELD_TIMEOUT_MS,
} from '@/services/moxfield/client';

export type SuggestionsInput = {
  formatMode: string;
  colorFilter?: string[];
  fetchEdhrecTop: () => Promise<{ name: string }[]>;
  fetchMoxfieldTop: () => Promise<{ status: number; names?: string[] }>;
  flagEnabled?: boolean;
};

export type SuggestionsResult = {
  names: string[];
  source: 'edhrec' | 'moxfield' | 'search-only';
  limitedData?: boolean;
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

export async function suggestionsFor(input: SuggestionsInput): Promise<SuggestionsResult> {
  const { formatMode, fetchEdhrecTop, fetchMoxfieldTop, flagEnabled = true } = input;

  if (formatMode === 'commander') {
    const data = await fetchEdhrecTop();
    const result: SuggestionsResult = {
      names: data.map((d) => d.name),
      source: 'edhrec',
    };
    return result;
  }

  if (formatMode === 'brawl100') {
    if (flagEnabled === false) {
      return { names: [], source: 'search-only', limitedData: true };
    }
    const res = await fetchMoxfieldTop();
    if (res.status !== 200 || !res.names?.length) {
      return { names: [], source: 'search-only', limitedData: true };
    }
    return { names: res.names, source: 'moxfield' };
  }

  return { names: [], source: 'search-only', limitedData: true };
}
