import type { CommunityBrawlPopularityResponse } from '@/services/brawl/fetchCommunityBrawlPopularity';
import type { BrawlTopCommandersResponse } from '@/services/brawl/fetchBrawlTopCommanders';

export type BrawlCommunitySnapshot = {
  generatedAt: string;
  topCommanders: Pick<BrawlTopCommandersResponse, 'source' | 'names' | 'limitedData'>;
  popularityByCommander: Record<
    string,
    Pick<CommunityBrawlPopularityResponse, 'source' | 'numDecks' | 'cards' | 'limitedData'>
  >;
};

let snapshotPromise: Promise<BrawlCommunitySnapshot | null> | null = null;

function snapshotUrl(): string {
  return `${import.meta.env.BASE_URL}data/brawl-community-snapshot.json`;
}

function normalizeCommanderKey(name: string): string {
  return name.trim().toLowerCase();
}

export function clearBrawlCommunitySnapshotCache(): void {
  snapshotPromise = null;
}

async function loadSnapshot(): Promise<BrawlCommunitySnapshot | null> {
  if (!snapshotPromise) {
    snapshotPromise = (async () => {
      try {
        const res = await fetch(snapshotUrl(), { headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        return (await res.json()) as BrawlCommunitySnapshot;
      } catch {
        return null;
      }
    })();
  }
  return snapshotPromise;
}

export async function topCommandersFromSnapshot(): Promise<BrawlTopCommandersResponse | null> {
  const snap = await loadSnapshot();
  const names = snap?.topCommanders?.names ?? [];
  if (!names.length) return null;
  const source = snap!.topCommanders.source === 'moxfield' ? 'moxfield' : 'archidekt';
  return {
    source,
    status: 200,
    names,
    limitedData: snap!.topCommanders.limitedData ?? true,
  };
}

export async function popularityFromSnapshot(
  commanderName: string,
): Promise<CommunityBrawlPopularityResponse | null> {
  const snap = await loadSnapshot();
  if (!snap?.popularityByCommander) return null;
  const entry =
    snap.popularityByCommander[normalizeCommanderKey(commanderName)] ??
    snap.popularityByCommander[commanderName.trim()];
  if (!entry?.cards?.length || !entry.numDecks) return null;
  const source = entry.source === 'moxfield' ? 'moxfield' : 'archidekt';
  return {
    source,
    status: 200,
    numDecks: entry.numDecks,
    cards: entry.cards,
    limitedData: entry.limitedData ?? entry.numDecks < 5,
  };
}
