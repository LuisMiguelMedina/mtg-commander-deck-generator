/**
 * Historic / Standard Brawl deck samples from Archidekt public API (server-side only).
 * Uses name search + commander verification on deck details.
 */

export type CommunityBrawlSearchResult = {
  status: number;
  numDecks?: number;
  cards?: Array<{ name: string; inclusion?: number; count?: number }>;
};

const ARCHIDEKT_LIST = 'https://archidekt.com/api/decks/v3/';
const ARCHIDEKT_DECK = 'https://archidekt.com/api/decks';
const USER_AGENT = 'Manafoundry/1.0 (+https://github.com/LuisMiguelMedina/mtg-commander-deck-generator)';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function searchToken(commanderName: string): string {
  const base = commanderName.split('//')[0].trim();
  const beforeComma = base.split(',')[0]?.trim() ?? base;
  return beforeComma.split(/\s+/)[0] || beforeComma;
}

function commanderNamesFromDeck(deck: {
  cards?: Array<{
    categories?: Array<string | { name?: string }>;
    card?: { oracleCard?: { name?: string } };
  }>;
}): string[] {
  const out: string[] = [];
  for (const row of deck.cards ?? []) {
    const cats = row.categories ?? [];
    const isCommander = cats.some((c) => {
      const label = typeof c === 'string' ? c : c?.name ?? '';
      return label.toLowerCase().includes('commander');
    });
    if (!isCommander) continue;
    const name = row.card?.oracleCard?.name;
    if (name) out.push(name);
  }
  return out;
}

function isBrawlDeckSize(size: number | undefined, cardCount: number): boolean {
  if (size !== undefined && size >= 55 && size <= 110) return true;
  return cardCount >= 35 && cardCount <= 105;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type DeckListRow = { id: number; size?: number; name?: string };

type DeckListResponse = { count?: number; results?: DeckListRow[] };

type DeckDetail = Parameters<typeof commanderNamesFromDeck>[0] & { id?: number; size?: number; cards?: unknown[] };

function aggregate(decks: DeckDetail[]): CommunityBrawlSearchResult {
  const tallies = new Map<string, { decks: number; copies: number }>();
  for (const deck of decks) {
    const seenInDeck = new Set<string>();
    for (const row of deck.cards ?? []) {
      const r = row as {
        categories?: Array<string | { name?: string }>;
        card?: { oracleCard?: { name?: string } };
        quantity?: number;
      };
      const name = r.card?.oracleCard?.name;
      if (!name) continue;
      const cats = r.categories ?? [];
      const isCmd = cats.some((c) => {
        const label = typeof c === 'string' ? c : c?.name ?? '';
        return label.toLowerCase().includes('commander');
      });
      if (isCmd) continue;
      const prev = tallies.get(name) ?? { decks: 0, copies: 0 };
      if (!seenInDeck.has(name)) {
        prev.decks += 1;
        seenInDeck.add(name);
      }
      prev.copies += r.quantity ?? 1;
      tallies.set(name, prev);
    }
  }
  const numDecks = decks.length;
  const cards = [...tallies.entries()]
    .map(([name, stats]) => ({
      name,
      inclusion: Math.round((stats.decks / numDecks) * 100),
      count: stats.copies,
    }))
    .sort((a, b) => (b.inclusion ?? 0) - (a.inclusion ?? 0));
  return { status: 200, numDecks, cards };
}

/** Aggregate card frequency from public Archidekt Brawl decks for one commander. */
export async function searchArchidektBrawl100Decks(
  commanderName: string,
): Promise<CommunityBrawlSearchResult> {
  const target = normalizeName(commanderName);
  const token = searchToken(commanderName);
  const params = new URLSearchParams({
    deckFormat: '13',
    pageSize: '50',
    orderBy: '-updatedAt',
    name: token,
  });

  const matched: DeckDetail[] = [];
  for (let page = 1; page <= 2 && matched.length < 16; page++) {
    params.set('page', String(page));
    const list = await fetchJson<DeckListResponse>(`${ARCHIDEKT_LIST}?${params.toString()}`);
    if (!list?.results?.length) break;

    const ids = list.results.map((r) => r.id);
    const batchSize = 6;
    for (let i = 0; i < ids.length && matched.length < 16; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map((id) => fetchJson<DeckDetail>(`${ARCHIDEKT_DECK}/${id}/`)),
      );
      for (const detail of details) {
        if (!detail) continue;
        const commanders = commanderNamesFromDeck(detail).map(normalizeName);
        if (!commanders.includes(target)) continue;
        const cardCount = detail.cards?.length ?? 0;
        if (!isBrawlDeckSize(detail.size, cardCount)) continue;
        matched.push(detail);
        if (matched.length >= 16) break;
      }
    }
  }

  if (matched.length === 0) {
    return { status: 404, numDecks: 0, cards: [] };
  }

  return aggregate(matched);
}
