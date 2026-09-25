import { getBrawl100Popularity, type Brawl100PopularityResult } from '@/services/popularity/provider';
import { searchBrawl100Decks } from '@/services/moxfield/client';
import { MOXFIELD_POPULARITY_ENABLED_DEFAULT } from '@/services/moxfield/flags';

/** Popularity context for the builder Archetype panel (Historic Brawl — not EDHREC themes). */
export async function fetchBrawl100ArchetypePopularity(
  commanderName: string,
): Promise<Brawl100PopularityResult> {
  return getBrawl100Popularity({
    commanderName,
    flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT,
    search: () => searchBrawl100Decks(commanderName),
  });
}
