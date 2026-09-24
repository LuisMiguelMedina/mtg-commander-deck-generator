import { getFormatRules } from '@/lib/format/formatMode';
import { adaptMoxfieldCardsToRanking } from '@/services/brawl/builderFormatPipeline';
import { getBrawl100Popularity, popularityProviderFor } from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import type { DeckDataSource } from '@/types';

type RankingCard = {
  name: string;
  inclusion?: number;
  count?: number;
};

export type BrewFormatPlanInput = {
  customization: { formatMode?: string; deckFormat: number };
  commanderName: string;
  legalCardNames?: string[];
  flagEnabled?: boolean;
  search: () => Promise<{ status: number; numDecks?: number; cards?: RankingCard[] }>;
  fetchEdhrec: () => Promise<unknown>;
};

export type BrewFormatPlan = {
  blocked?: boolean;
  generation?: string;
  formatMode?: string;
  popularityProviderId?: string;
  deckSize?: number;
  legalityMode?: string;
  dataSource?: DeckDataSource;
  candidateNames?: string[];
  limitedData?: boolean;
};

/** Brawl100 brew offers: Moxfield ranking ∩ legal pool, or full legal pool on degrade — never EDHREC-only names. */
export function selectBrewOffers(input: {
  legalCardNames: string[];
  rankingCards?: RankingCard[];
  edhrecNames?: string[];
}): { names: string[] } {
  const { legalCardNames, rankingCards = [] } = input;
  if (legalCardNames.length === 0) {
    return { names: [] };
  }
  const legalSet = new Set(legalCardNames);
  if (rankingCards.length === 0) {
    return { names: [...legalCardNames] };
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const card of rankingCards) {
    if (legalSet.has(card.name) && !seen.has(card.name)) {
      seen.add(card.name);
      names.push(card.name);
    }
  }
  return { names };
}

export async function resolveBrewFormatPlan(input: BrewFormatPlanInput): Promise<BrewFormatPlan> {
  const formatMode = input.customization.formatMode ?? 'commander';
  const rules = getFormatRules(formatMode);

  if (!rules || rules.generation === 'named-only' || rules.generation === 'removed' || formatMode === 'standardBrawl60') {
    return { blocked: true, generation: rules?.generation ?? 'removed', formatMode };
  }

  const popularityProviderId = popularityProviderFor(formatMode)?.id;

  if (formatMode === 'brawl100') {
    const legalCardNames = input.legalCardNames ?? [];
    const flagEnabled = input.flagEnabled ?? MOXFIELD_POPULARITY_ENABLED_DEFAULT;
    const popularity = await getBrawl100Popularity({
      commanderName: input.commanderName,
      flagEnabled,
      search: input.search,
    });
    const rankingCards =
      popularity.dataSource === 'moxfield' && popularity.cards?.length
        ? adaptMoxfieldCardsToRanking(popularity.cards)
        : [];
    const { names: candidateNames } = selectBrewOffers({
      legalCardNames,
      rankingCards,
    });
    return {
      blocked: false,
      generation: 'implemented',
      formatMode,
      deckSize: rules.deckSize,
      legalityMode: 'brawl100',
      popularityProviderId,
      dataSource: popularity.dataSource,
      candidateNames,
      limitedData: popularity.limitedData,
    };
  }

  if (formatMode === 'commander') {
    await input.fetchEdhrec();
    return {
      blocked: false,
      generation: 'implemented',
      formatMode,
      deckSize: rules.deckSize,
      legalityMode: 'commander',
      popularityProviderId,
    };
  }

  return { blocked: true, generation: 'named-only', formatMode };
}
