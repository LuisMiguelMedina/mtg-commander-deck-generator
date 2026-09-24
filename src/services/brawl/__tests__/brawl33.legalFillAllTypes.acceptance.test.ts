import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-BRAWL-33 acceptance (red until the legal pool fills every non-land type list).
 * docs/pbi/PBI-BRAWL-33-legal-fill-all-types.md
 *
 * Product gap at 1ae716d: `generateDeck`'s brawl100 block runs `selectFormatFill`,
 * then writes every returned name into `cardlists.creatures` and clears
 * instants, sorceries, artifacts, enchantments, and planeswalkers. Those ranked
 * rows also have no `primary_type`, so the existing type-slot merge only sees
 * them as creatures (non-creature slots fall through to Unknown backfill).
 *
 * Intended seam on `src/services/brawl/builderFormatPipeline.ts`, beside
 * `selectFormatFill` (flat names stay as they are — this only classifies):
 *   classifyLegalFill({
 *     names: string[],  // selectFormatFill().names — the legal fill
 *     cards: { name, primary_type?, type_line? }[],
 *   }) => {
 *     creatures, instants, sorceries, artifacts, enchantments, planeswalkers, allNonLand
 *   }
 *     a name is placed only when it is in `names`
 *     primary_type Creature|Instant|Sorcery|Artifact|Enchantment|Planeswalker
 *       (any case) selects that one list
 *     Land is left out of every non-land list and out of allNonLand
 *     missing / Unknown primary_type falls back to type_line, creature before
 *       artifact (same order the generator already uses for slots)
 *     a card is not copied into every list; creatures receive only creatures
 *     allNonLand is the union of the non-land lists
 *
 * Production wiring in `generateDeck` (`formatMode === 'brawl100'` cardlists):
 *   calls classifyLegalFill and assigns each typed list from that result
 *   does not set `creatures: ranked` with the other non-land lists emptied
 *   no new scorer
 *
 * Commander generate still loads EDHREC (`fetchCommanderData`) and is not
 * rewritten onto this classifier.
 */

const PIPELINE_MODULE = '@/services/brawl/builderFormatPipeline';
const GENERATOR_PATH = 'src/services/deckBuilder/deckGenerator.ts';

type TypedCard = { name: string; primary_type?: string; type_line?: string };

type ClassifiedLists = {
  creatures: string[];
  instants: string[];
  sorceries: string[];
  artifacts: string[];
  enchantments: string[];
  planeswalkers: string[];
  allNonLand: string[];
};

const typedPool: TypedCard[] = [
  { name: 'Thought Monitor', primary_type: 'Creature', type_line: 'Artifact Creature — Construct' },
  { name: 'Counterspell', primary_type: 'Instant', type_line: 'Instant' },
  { name: 'Wrath of God', primary_type: 'Sorcery', type_line: 'Sorcery' },
  { name: 'Sol Ring', primary_type: 'Artifact', type_line: 'Artifact' },
  { name: 'Rhystic Study', primary_type: 'Enchantment', type_line: 'Enchantment' },
  { name: 'Jace, the Mind Sculptor', primary_type: 'Planeswalker', type_line: 'Legendary Planeswalker — Jace' },
  { name: 'Island', primary_type: 'Land', type_line: 'Basic Land — Island' },
];

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return '';
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + signature.length + next);
}

function brawlCardlistBlock(source: string): string {
  const marker = "if (formatMode === 'brawl100')";
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(marker, from);
    if (start < 0) return '';
    const slice = source.slice(start, start + 1400);
    if (slice.includes('cardlists')) return slice;
    from = start + marker.length;
  }
  return '';
}

describe('PBI-BRAWL-33 legal pool fills every non-land type list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifyLegalFill puts each legal non-land into its type list instead of creatures', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const classify = mod?.classifyLegalFill as ((input: {
      names: string[];
      cards: TypedCard[];
    }) => ClassifiedLists) | undefined;

    expect(typeof classify, `${PIPELINE_MODULE} classifyLegalFill`).toBe('function');
    if (typeof classify !== 'function') return;

    const names = typedPool.map((card) => card.name);
    const lists = classify({ names, cards: typedPool });

    expect(new Set(lists.creatures)).toEqual(new Set(['Thought Monitor']));
    expect(new Set(lists.instants)).toEqual(new Set(['Counterspell']));
    expect(new Set(lists.sorceries)).toEqual(new Set(['Wrath of God']));
    expect(new Set(lists.artifacts)).toEqual(new Set(['Sol Ring']));
    expect(new Set(lists.enchantments)).toEqual(new Set(['Rhystic Study']));
    expect(new Set(lists.planeswalkers)).toEqual(new Set(['Jace, the Mind Sculptor']));
    expect(lists.creatures).not.toContain('Counterspell');
    expect(lists.creatures).not.toContain('Sol Ring');
    expect(lists.creatures).not.toContain('Island');
    expect(lists.instants.length).toBeGreaterThan(0);
    expect(lists.artifacts.length).toBeGreaterThan(0);
    expect(lists.enchantments.length).toBeGreaterThan(0);
    expect(lists.planeswalkers.length).toBeGreaterThan(0);
    expect(new Set(lists.allNonLand)).toEqual(new Set([
      'Thought Monitor',
      'Counterspell',
      'Wrath of God',
      'Sol Ring',
      'Rhystic Study',
      'Jace, the Mind Sculptor',
    ]));
    expect(lists.allNonLand).not.toContain('Island');
  });

  it('classifyLegalFill uses type_line when primary_type is Unknown so slots are not Unknown-only', async () => {
    const mod = await tryLoadSeam(PIPELINE_MODULE);
    const classify = mod?.classifyLegalFill as ((input: {
      names: string[];
      cards: TypedCard[];
    }) => ClassifiedLists) | undefined;

    expect(typeof classify, `${PIPELINE_MODULE} classifyLegalFill`).toBe('function');
    if (typeof classify !== 'function') return;

    const lists = classify({
      names: ['Swords to Plowshares', 'Arcane Signet', 'Beast Within', 'Bolas\'s Citadel'],
      cards: [
        { name: 'Swords to Plowshares', primary_type: 'Unknown', type_line: 'Instant' },
        { name: 'Arcane Signet', type_line: 'Artifact' },
        { name: 'Beast Within', primary_type: 'unknown', type_line: 'Instant' },
        { name: 'Bolas\'s Citadel', primary_type: 'Artifact', type_line: 'Legendary Artifact' },
      ],
    });

    expect(new Set(lists.instants)).toEqual(new Set(['Swords to Plowshares', 'Beast Within']));
    expect(new Set(lists.artifacts)).toEqual(new Set(['Arcane Signet', 'Bolas\'s Citadel']));
    expect(lists.creatures).toEqual([]);
    expect(lists.sorceries).toEqual([]);
    expect(new Set(lists.allNonLand)).toEqual(new Set([
      'Swords to Plowshares',
      'Arcane Signet',
      'Beast Within',
      'Bolas\'s Citadel',
    ]));
  });

  it('generateDeck brawl100 cardlists are typed, not one creatures dump with the other lists cleared', async () => {
    const body = functionBody(await readRepoText(GENERATOR_PATH), 'export async function generateDeck');
    const block = brawlCardlistBlock(body);

    expect(block, 'brawl100 cardlists assignment').not.toBe('');
    expect(
      /creatures:\s*ranked/.test(block),
      'every legal name is dumped into cardlists.creatures',
    ).toBe(false);
    expect(/instants:\s*\[\s*\]/.test(block), 'brawl100 fill clears instants').toBe(false);
    expect(/sorceries:\s*\[\s*\]/.test(block), 'brawl100 fill clears sorceries').toBe(false);
    expect(/artifacts:\s*\[\s*\]/.test(block), 'brawl100 fill clears artifacts').toBe(false);
    expect(/enchantments:\s*\[\s*\]/.test(block), 'brawl100 fill clears enchantments').toBe(false);
    expect(/planeswalkers:\s*\[\s*\]/.test(block), 'brawl100 fill clears planeswalkers').toBe(false);
    expect(/classifyLegalFill\s*\(/.test(block), 'brawl100 fill does not classify the legal pool by type').toBe(true);
    expect(/calculateCardPriority|new Scorer|class Scorer/.test(block), 'brawl100 fill rewrites the scorer').toBe(false);
  });

  it('commander generate still loads EDHREC and does not classify through the brawl legal fill', async () => {
    const body = functionBody(await readRepoText(GENERATOR_PATH), 'export async function generateDeck');
    const commanderFetch = body.indexOf('fetchCommanderData');
    const brawlRewrite = body.indexOf("if (formatMode === 'brawl100')");

    expect(commanderFetch, 'generateDeck still fetches commander EDHREC data').toBeGreaterThanOrEqual(0);
    expect(brawlRewrite, 'brawl100 fill stays behind its own formatMode branch').toBeGreaterThan(commanderFetch);
    expect(/fetchCommanderData\s*\(/.test(body), 'commander EDHREC fetch was removed').toBe(true);
  });
});
