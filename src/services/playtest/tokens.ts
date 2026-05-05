import type { ScryfallCard } from '@/types';
import { searchCards } from '@/services/scryfall/client';

/**
 * Resolves a list of Scryfall token cards filtered for the deck's color identity.
 * Returns up to ~60 of the most popular tokens within the color identity.
 *
 * `colorIdentity` is a string like 'WUB' (subset of WUBRG). Empty string means colorless.
 *
 * Routes through the shared scryfall client so it inherits rate limiting,
 * the search-result cache, and any future request middleware.
 */
export async function resolveTokens(colorIdentity: string): Promise<ScryfallCard[]> {
  const ci = colorIdentity ? colorIdentity.toUpperCase().split('') : [];
  // Tokens are not commander-legal, so skip the f:commander filter.
  // For colorless decks, embed id:c directly since searchCards drops the
  // color filter when the array is empty.
  const query = ci.length === 0 ? 'is:token id:c' : 'is:token';
  try {
    const response = await searchCards(query, ci, {
      order: 'edhrec',
      skipFormatFilter: true,
    });
    return (response.data ?? [])
      .filter((c: ScryfallCard & { set_type?: string }) => c.set_type === 'token')
      .slice(0, 60);
  } catch {
    return [];
  }
}

/** Derives a color-identity string ('WUBRG' subset) from the command zone cards. */
export function deriveColorIdentity(commanders: ScryfallCard[]): string {
  const set = new Set<string>();
  for (const c of commanders) {
    for (const ch of c.color_identity ?? []) set.add(ch.toUpperCase());
  }
  return ['W', 'U', 'B', 'R', 'G'].filter(c => set.has(c)).join('');
}
