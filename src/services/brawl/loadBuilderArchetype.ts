import { getBrawl100Popularity, type Brawl100PopularityResult } from '@/services/popularity/provider';
import { searchBrawl100DecksProxied } from '@/services/brawl/fetchCommunityBrawlPopularity';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';

function toSearchResult(
  response: Awaited<ReturnType<typeof searchBrawl100DecksProxied>>,
): { status: number; numDecks?: number; cards?: Array<{ name: string; inclusion?: number; count?: number }>; popularitySource?: 'moxfield' | 'archidekt' } {
  if (response.source === 'moxfield' || response.source === 'archidekt') {
    return {
      status: 200,
      numDecks: response.numDecks,
      cards: response.cards,
      popularitySource: response.source,
    };
  }
  return { status: response.status || 403 };
}

/** Popularity context for the builder Archetype panel (Historic Brawl — not EDHREC themes). */
export async function fetchBrawl100ArchetypePopularity(
  commanderName: string,
): Promise<Brawl100PopularityResult> {
  return getBrawl100Popularity({
    commanderName,
    flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
    search: () => searchBrawl100DecksProxied(commanderName).then(toSearchResult),
  });
}
