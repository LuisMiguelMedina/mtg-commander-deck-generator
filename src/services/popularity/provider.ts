import { MOXFIELD_BRAWL100_FMT } from '@/services/moxfield/fmt';
import type { DeckDataSource } from '@/types';

export type PopularityProvider = {
  id: 'edhrec' | 'moxfield';
};

export function popularityProviderFor(mode: string): PopularityProvider | undefined {
  if (mode === 'commander') return { id: 'edhrec' };
  if (mode === 'brawl100') return { id: 'moxfield' };
  return undefined;
}

type SearchCard = {
  name: string;
  inclusion?: number;
  count?: number;
};

type SearchResult = {
  status: number;
  numDecks?: number;
  cards?: SearchCard[];
};

export type Brawl100PopularityResult = {
  dataSource: DeckDataSource;
  limitedData?: boolean;
  numDecks?: number;
  fmt?: string;
  cards?: Array<{ name: string; inclusion?: number; count?: number }>;
};

function shouldDegradeToScryfall(status: number): boolean {
  return status === 403 || status >= 500;
}

export async function getBrawl100Popularity(input: {
  commanderName: string;
  flagEnabled: boolean;
  search: () => Promise<SearchResult>;
}): Promise<Brawl100PopularityResult> {
  if (!input.flagEnabled) {
    return { dataSource: 'scryfall', limitedData: true };
  }

  try {
    const result = await input.search();
    if (shouldDegradeToScryfall(result.status)) {
      return { dataSource: 'scryfall' };
    }
    if (result.status !== 200) {
      return { dataSource: 'scryfall' };
    }
    if (!result.numDecks || result.numDecks <= 0) {
      return { dataSource: 'scryfall', limitedData: true };
    }
    const normalizedCards = (result.cards ?? []).map((card) => ({
      name: card.name,
      inclusion: card.inclusion,
      count: card.count,
    }));
    if (normalizedCards.length === 0) {
      return { dataSource: 'scryfall', limitedData: true };
    }

    return {
      dataSource: 'moxfield',
      numDecks: result.numDecks,
      fmt: MOXFIELD_BRAWL100_FMT,
      cards: normalizedCards.map((card) => ({
        name: card.name,
        inclusion: card.inclusion,
        count: card.count,
      })),
    };
  } catch {
    return { dataSource: 'scryfall' };
  }
}
