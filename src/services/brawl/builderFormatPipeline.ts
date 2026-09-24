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

export type BuilderFormatPipelineInput = {
  formatMode: string;
  commander: CardFace;
  pool: PoolCard[];
  search: () => Promise<{ status: number; numDecks?: number; cards?: unknown[] }>;
  fetchEdhrecThemes: () => Promise<unknown[]>;
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
};

export async function resolveBuilderFormatPipeline(
  input: BuilderFormatPipelineInput,
): Promise<BuilderFormatPipelineResult> {
  const rules = getFormatRules(input.formatMode);
  if (!rules || rules.generation === 'named-only' || input.formatMode === 'standardBrawl60') {
    return { blocked: true, generation: rules?.generation ?? 'named-only' };
  }

  const commanderEligible = isEligibleCommander(input.commander, input.formatMode);
  const legalCardNames = input.pool
    .filter((card) => isLegalForFormat(card, input.formatMode))
    .map((card) => card.name);
  const popularityProviderId = popularityProviderFor(input.formatMode)?.id;

  if (input.formatMode === 'brawl100') {
    const popularity = await getBrawl100Popularity({
      commanderName: input.commander.name,
      flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
      search: input.search,
    });
    return {
      blocked: false,
      generation: 'implemented',
      commanderEligible,
      legalCardNames,
      popularityProviderId,
      dataSource: popularity.dataSource,
      themesFetched: false,
      themes: [],
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
    };
  }

  return { blocked: true, generation: 'named-only' };
}
