/**
 * Build-time community Brawl data (Archidekt; Moxfield when reachable from CI).
 * Shipped as static JSON so GitHub Pages works without the analytics Lambda.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBrawlTopCommandersServer } from '../src/services/brawl/fetchBrawlTopCommanders.ts';
import { searchArchidektBrawl100Decks } from '../src/services/brawl/archidektBrawl100.ts';
import type { BrawlCommunitySnapshot } from '../src/services/brawl/brawlCommunitySnapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/data/brawl-community-snapshot.json');

/** Always prefetch archetype samples for commanders users report missing list data. */
const EXTRA_COMMANDERS = [
  'Ral, Crackling Wit',
  'Kinnan, Bonder Prodigy',
  'Niv-Mizzet, Parun',
  'Atraxa, Grand Unifier',
  'Etali, Primal Conqueror // Etali, Primal Sickness',
  'Sythis, Harvest\'s Hand',
  'Imoti, Celebrant of Bounty',
  'Golos, Tireless Pilgrim',
  'Esika, God of the Tree // The Prismatic Bridge',
  'Roxanne, Starfall Savant',
];

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

async function main() {
  const top = await fetchBrawlTopCommandersServer();
  const names = top.names ?? [];
  await new Promise((r) => setTimeout(r, 2000));
  const commanders = [
    ...EXTRA_COMMANDERS,
    ...names.filter((n) => !EXTRA_COMMANDERS.some((e) => e.toLowerCase() === n.toLowerCase())),
  ];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const popularityByCommander: BrawlCommunitySnapshot['popularityByCommander'] = {};
  for (const name of commanders) {
    let result = await searchArchidektBrawl100Decks(name);
    if (result.status !== 200 || !result.numDecks || !result.cards?.length) {
      await sleep(2500);
      result = await searchArchidektBrawl100Decks(name);
    }
    if (result.status === 200 && result.numDecks && result.cards?.length) {
      popularityByCommander[normalizeKey(name)] = {
        source: 'archidekt',
        numDecks: result.numDecks,
        cards: result.cards.slice(0, 120),
        limitedData: result.numDecks < 5,
      };
    } else {
      console.warn(`[brawl-snapshot] no Archidekt data for ${name}`);
    }
    await sleep(2000);
  }

  const snapshot: BrawlCommunitySnapshot = {
    generatedAt: new Date().toISOString(),
    topCommanders: {
      source: top.source === 'moxfield' ? 'moxfield' : 'archidekt',
      names,
      limitedData: top.limitedData ?? names.length < 8,
    },
    popularityByCommander,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(
    `[brawl-snapshot] ${names.length} top commanders, ${Object.keys(popularityByCommander).length} popularity entries → ${OUT}`,
  );
}

main().catch((err) => {
  console.error('[brawl-snapshot] failed (keeping existing snapshot if present):', err);
  process.exit(0);
});
