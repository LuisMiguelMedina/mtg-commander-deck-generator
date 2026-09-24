import { getFormatRules } from '@/lib/format/formatMode';
import { getBrawl100Popularity, popularityProviderFor } from '@/services/popularity/provider';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';
import type { DeckDataSource } from '@/types';

export type BrewFormatPlanInput = {
  customization: { formatMode?: string; deckFormat: number };
  commanderName: string;
  search: () => Promise<{ status: number; numDecks?: number; cards?: unknown[] }>;
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
};

export async function resolveBrewFormatPlan(input: BrewFormatPlanInput): Promise<BrewFormatPlan> {
  const formatMode = input.customization.formatMode ?? 'commander';
  const rules = getFormatRules(formatMode);

  if (!rules || rules.generation === 'named-only' || formatMode === 'standardBrawl60') {
    return { blocked: true, generation: rules?.generation ?? 'named-only', formatMode };
  }

  const popularityProviderId = popularityProviderFor(formatMode)?.id;

  if (formatMode === 'brawl100') {
    const popularity = await getBrawl100Popularity({
      commanderName: input.commanderName,
      flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
      search: input.search,
    });
    return {
      blocked: false,
      generation: 'implemented',
      formatMode,
      deckSize: rules.deckSize,
      legalityMode: 'brawl100',
      popularityProviderId,
      dataSource: popularity.dataSource,
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
