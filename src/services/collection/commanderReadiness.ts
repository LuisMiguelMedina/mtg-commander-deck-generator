import { fetchCommanderData } from '@/services/edhrec/client';
import type { CollectionCard } from '@/services/collection/db';

export interface CommanderReadiness {
  commanderName: string;
  /** Number of EDHREC staples for this commander that the player owns. */
  ownedCount: number;
  /** Total staples considered (top N nonland + a slice of lands). */
  totalCount: number;
  /** ownedCount / totalCount as a percentage 0-100. */
  percent: number;
  /** Cards in the staple pool that the player owns (canonical Scryfall names). */
  ownedNames: string[];
}

/** How many top non-land staples to count toward readiness. */
const TOP_NONLAND = 80;
/** How many top lands to count toward readiness (most decks reuse the same staple lands). */
const TOP_LANDS = 20;

const readinessCache = new Map<string, CommanderReadiness>();

/**
 * Build a lookup set of canonical names from the collection.
 * EDHREC and Scryfall both use the front-face name as the canonical form,
 * which matches what we store in CollectionCard.name.
 */
function buildOwnedNameSet(collection: CollectionCard[]): Set<string> {
  const set = new Set<string>();
  for (const card of collection) {
    set.add(card.name);
  }
  return set;
}

/**
 * Compute readiness for a single commander.
 *
 * Strategy: fetch the commander's EDHREC top-card lists, take the top N non-land
 * staples and the top M lands, then count how many of those the player owns.
 * Caches per session (independent of the EDHREC 5-min cache so re-renders are instant).
 */
export async function computeCommanderReadiness(
  commanderName: string,
  collection: CollectionCard[],
): Promise<CommanderReadiness> {
  const cacheKey = `${commanderName}::${collection.length}`;
  const cached = readinessCache.get(cacheKey);
  if (cached) return cached;

  const owned = buildOwnedNameSet(collection);

  try {
    const data = await fetchCommanderData(commanderName);
    const topNonLand = data.cardlists.allNonLand.slice(0, TOP_NONLAND);
    const topLands = data.cardlists.lands.slice(0, TOP_LANDS);
    const pool = [...topNonLand, ...topLands];

    const ownedNames: string[] = [];
    for (const staple of pool) {
      if (owned.has(staple.name)) ownedNames.push(staple.name);
    }

    const result: CommanderReadiness = {
      commanderName,
      ownedCount: ownedNames.length,
      totalCount: pool.length,
      percent: pool.length > 0 ? (ownedNames.length / pool.length) * 100 : 0,
      ownedNames,
    };
    readinessCache.set(cacheKey, result);
    return result;
  } catch {
    // EDHREC down, commander not in their database, etc. — neutral zero.
    const result: CommanderReadiness = {
      commanderName,
      ownedCount: 0,
      totalCount: 0,
      percent: 0,
      ownedNames: [],
    };
    return result;
  }
}

/** Clear the readiness cache (e.g. when the collection changes meaningfully). */
export function clearReadinessCache(): void {
  readinessCache.clear();
}
