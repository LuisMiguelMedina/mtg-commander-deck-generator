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

const NON_LAND_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Planeswalker',
] as const;

type NonLandType = (typeof NON_LAND_TYPES)[number];

function primaryTypeFromTypeLine(typeLine: string): NonLandType | 'Land' | 'Unknown' {
  const tl = typeLine.split('—')[0].split('//')[0].toLowerCase();
  if (tl.includes('creature')) return 'Creature';
  if (tl.includes('instant')) return 'Instant';
  if (tl.includes('sorcery')) return 'Sorcery';
  if (tl.includes('artifact')) return 'Artifact';
  if (tl.includes('enchantment')) return 'Enchantment';
  if (tl.includes('planeswalker')) return 'Planeswalker';
  if (tl.includes('land')) return 'Land';
  return 'Unknown';
}

function normalizePrimaryType(raw?: string): NonLandType | 'Land' | 'Unknown' {
  if (!raw) return 'Unknown';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'land') return 'Land';
  for (const type of NON_LAND_TYPES) {
    if (normalized === type.toLowerCase()) return type;
  }
  return 'Unknown';
}

function resolveFillPrimaryType(card: { primary_type?: string; type_line?: string }): NonLandType | 'Land' | 'Unknown' {
  const fromPrimary = normalizePrimaryType(card.primary_type);
  if (fromPrimary !== 'Unknown') return fromPrimary;
  if (card.type_line) return primaryTypeFromTypeLine(card.type_line);
  return 'Unknown';
}

export function classifyLegalFill(input: {
  names: string[];
  cards: Array<{ name: string; primary_type?: string; type_line?: string }>;
}): {
  creatures: string[];
  instants: string[];
  sorceries: string[];
  artifacts: string[];
  enchantments: string[];
  planeswalkers: string[];
  allNonLand: string[];
} {
  const byName = new Map(input.cards.map((card) => [card.name, card]));
  const lists: Record<NonLandType, string[]> = {
    Creature: [],
    Instant: [],
    Sorcery: [],
    Artifact: [],
    Enchantment: [],
    Planeswalker: [],
  };

  for (const name of input.names) {
    const card = byName.get(name);
    const primaryType = card ? resolveFillPrimaryType(card) : 'Unknown';
    if (primaryType === 'Land' || primaryType === 'Unknown') continue;
    lists[primaryType].push(name);
  }

  const allNonLand = NON_LAND_TYPES.flatMap((type) => lists[type]);
  return {
    creatures: lists.Creature,
    instants: lists.Instant,
    sorceries: lists.Sorcery,
    artifacts: lists.Artifact,
    enchantments: lists.Enchantment,
    planeswalkers: lists.Planeswalker,
    allNonLand,
  };
}

export function selectFormatFill(input: {
  legalCardNames: string[];
  rankingCards?: Array<{ name: string; inclusion?: number }>;
  edhrecNames?: string[];
}): { names: string[] } {
  const { legalCardNames, rankingCards = [], edhrecNames = [] } = input;
  if (legalCardNames.length === 0) {
    return { names: [] };
  }

  const legalSet = new Set(legalCardNames);
  if (rankingCards.length === 0) {
    return { names: [...legalCardNames] };
  }

  const names = new Set<string>();
  for (const card of rankingCards) {
    if (legalSet.has(card.name)) {
      names.add(card.name);
    }
  }
  for (const name of legalCardNames) {
    names.add(name);
  }
  for (const name of edhrecNames) {
    if (legalSet.has(name)) {
      names.add(name);
    }
  }
  return { names: [...names] };
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
