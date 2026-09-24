import { describe, expect, it } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';

/**
 * PBI-BRAWL-02 acceptance (red until the pure legality seam exists).
 * docs/pbi/PBI-BRAWL-02-scryfall-brawl-legality.md
 *
 * Intended seam: `isLegalForFormat` from `src/services/scryfall/legality.ts`.
 * brawl100 gates on `legalities.brawl === 'legal'`.
 * commander keeps the current `legalities.commander` gate.
 * `arenaOnly` composes with AND (`games` includes `arena`).
 * Fixtures only — no network.
 *
 * Today legality is private `isCommanderLegalOrUpcoming` in
 * `src/services/scryfall/client.ts` plus scattered `legalities.commander` checks.
 * There is no `legalities.brawl` branch.
 */

const LEGALITY_MODULE = '@/services/scryfall/legality';

type LegalityFixture = {
  name: string;
  legalities: Record<string, string>;
  games?: string[];
};

function card(partial: LegalityFixture): LegalityFixture {
  return partial;
}

describe('PBI-BRAWL-02 Scryfall legalities.brawl', () => {
  const brawlLegal = card({
    name: 'Thought Monitor',
    legalities: { brawl: 'legal', commander: 'legal' },
    games: ['arena', 'paper'],
  });
  const notLegal = card({
    name: 'Sol Ring',
    legalities: { brawl: 'not_legal', commander: 'legal' },
    games: ['paper'],
  });
  const banned = card({
    name: 'Banned Brawl Card',
    legalities: { brawl: 'banned', commander: 'legal' },
    games: ['arena'],
  });
  const restricted = card({
    name: 'Restricted Brawl Card',
    legalities: { brawl: 'restricted', commander: 'legal' },
    games: ['arena'],
  });
  const commanderBanned = card({
    name: 'Flash',
    legalities: { brawl: 'legal', commander: 'banned' },
    games: ['paper'],
  });
  const paperOnlyBrawlLegal = card({
    name: 'Paper Only',
    legalities: { brawl: 'legal', commander: 'legal' },
    games: ['paper'],
  });

  async function isLegal(
    fixture: LegalityFixture,
    mode: string,
    options?: { arenaOnly?: boolean },
  ): Promise<boolean | undefined> {
    const mod = await tryLoadSeam(LEGALITY_MODULE);
    const fn = mod?.isLegalForFormat as ((
      card: LegalityFixture,
      mode: string,
      options?: { arenaOnly?: boolean },
    ) => boolean) | undefined;
    return typeof fn === 'function' ? fn(fixture, mode, options) : undefined;
  }

  it('brawl100 accepts only legalities.brawl === legal', async () => {
    expect(await isLegal(brawlLegal, 'brawl100')).toBe(true);
    expect(await isLegal(notLegal, 'brawl100')).toBe(false);
    expect(await isLegal(banned, 'brawl100')).toBe(false);
    expect(await isLegal(restricted, 'brawl100')).toBe(false);
  });

  it('commander mode uses the commander gate and does not apply legalities.brawl', async () => {
    expect(await isLegal(notLegal, 'commander')).toBe(true);
    expect(await isLegal(notLegal, 'brawl100')).toBe(false);
    expect(await isLegal(commanderBanned, 'commander')).toBe(false);
    expect(await isLegal(brawlLegal, 'commander')).toBe(true);
  });

  it('arenaOnly AND brawl legality: both gates must pass', async () => {
    expect(await isLegal(brawlLegal, 'brawl100', { arenaOnly: true })).toBe(true);
    expect(await isLegal(paperOnlyBrawlLegal, 'brawl100', { arenaOnly: true })).toBe(false);
    expect(await isLegal(banned, 'brawl100', { arenaOnly: true })).toBe(false);
    expect(await isLegal(paperOnlyBrawlLegal, 'brawl100')).toBe(true);
    expect(await isLegal(paperOnlyBrawlLegal, 'brawl100', { arenaOnly: false })).toBe(true);
  });
});
