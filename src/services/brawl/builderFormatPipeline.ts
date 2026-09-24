import { getFormatRules, isEligibleCommander } from '@/lib/format/formatMode';
import { isLegalForFormat } from '@/services/scryfall/legality';
import { getBrawl100Popularity, popularityProviderFor } from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import type { DeckDataSource } from '@/types';

type CardFace = {
  name: string;
  type_line: string;
  color_identity: string[];
};

type PoolCard = {
  name: string;
  legalities?: Record<string, string>;
  games?: string[];
};

type RankingCard = {
  name: string;
  inclusion?: number;
  count?: number;
};

export type BuilderFormatPipelineInput = {
  formatMode: string;
  commander: CardFace;
  pool: PoolCard[];
  search: () => Promise<{ status: number; numDecks?: number; cards?: RankingCard[] }>;
  fetchEdhrecThemes: () => Promise<unknown[]>;
  flagEnabled?: boolean;
};

export type BuilderFormatPipelineResult = {
  blocked?: boolean;
  generation?: string;
  commanderEligible?: boolean;
  legalCardNames?: string[];
  popularityProviderId?: string;
  dataSource?: DeckDataSource;
  themesFetched?: boolean;
  themes?: unknown[];
  deckSize?: number;
  rankingCards?: RankingCard[];
};

export function buildLegalFormatPool<T extends PoolCard>(candidates: T[], formatMode: string): T[] {
  return candidates.filter((card) => isLegalForFormat(card, formatMode));
}

export function adaptMoxfieldCardsToRanking(cards: RankingCard[]): RankingCard[] {
  return cards.map((card) => ({
    name: card.name,
    inclusion: card.inclusion ?? card.count ?? 0,
    ...(card.count !== undefined ? { count: card.count } : {}),
  }));
}

export async function resolveBuilderFormatPipeline(
  input: BuilderFormatPipelineInput,
): Promise<BuilderFormatPipelineResult> {
  const rules = getFormatRules(input.formatMode);
  if (!rules || rules.generation === 'removed' || input.formatMode === 'standardBrawl60') {
    return { blocked: true, generation: rules?.generation ?? 'removed' };
  }
  if (rules.generation === 'named-only') {
    return { blocked: true, generation: 'named-only' };
  }

  const deckSize = rules.deckSize;
  const commanderEligible = isEligibleCommander(input.commander, input.formatMode);
  const legalCardNames = buildLegalFormatPool(input.pool, input.formatMode).map((card) => card.name);
  const popularityProviderId = popularityProviderFor(input.formatMode)?.id;

  if (input.formatMode === 'brawl100') {
    const flagEnabled = input.flagEnabled ?? MOXFIELD_POPULARITY_ENABLED_DEFAULT;
    const popularity = await getBrawl100Popularity({
      commanderName: input.commander.name,
      flagEnabled,
      search: input.search,
    });
    const rankingCards =
      popularity.dataSource === 'moxfield' && popularity.cards?.length
        ? adaptMoxfieldCardsToRanking(popularity.cards)
        : [];
    return {
      blocked: false,
      generation: 'implemented',
      commanderEligible,
      legalCardNames,
      popularityProviderId,
      dataSource: popularity.dataSource,
      themesFetched: false,
      themes: [],
      deckSize,
      rankingCards,
    };
  }

  if (input.formatMode === 'commander') {
    const themes = await input.fetchEdhrecThemes();
    return {
      blocked: false,
      generation: 'implemented',
      commanderEligible,
      legalCardNames,
      popularityProviderId,
      themesFetched: true,
      themes,
      deckSize,
      rankingCards: [],
    };
  }

  return { blocked: true, generation: 'named-only' };
}
