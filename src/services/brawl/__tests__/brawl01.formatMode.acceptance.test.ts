import { describe, expect, it } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';

/**
 * PBI-BRAWL-01 acceptance (red until FormatMode exists).
 * docs/pbi/PBI-BRAWL-01-format-mode.md
 * docs/architecture/ADR-brawl-fase1.md
 *
 * Intended seam: `src/lib/format/formatMode.ts`
 *   FORMAT_MODES, getFormatRules, isEligibleCommander, validateFormatDeck
 * Extends Commander. Does not fork the generator.
 * `standardBrawl60` is named only — no generation path in fase 1.
 *
 * Today the product keys format by deck size (`DECK_FORMAT_CONFIGS` in
 * `src/lib/constants/archetypes.ts`: 40 / 60 / 99) and has no FormatMode,
 * starting life, or commander-damage flag.
 */

const FORMAT_MODULE = '@/lib/format/formatMode';

type CardFace = {
  name: string;
  type_line: string;
  color_identity: string[];
  oracle_text?: string;
};

function face(partial: Partial<CardFace> & Pick<CardFace, 'name' | 'type_line'>): CardFace {
  return { color_identity: [], oracle_text: '', ...partial };
}

describe('PBI-BRAWL-01 FormatMode + Brawl 100 rules', () => {
  it('FormatMode product modes are commander and brawl100 only', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const modes = mod?.FORMAT_MODES as readonly string[] | undefined;

    expect(modes, `${FORMAT_MODULE} FORMAT_MODES`).toEqual(['commander', 'brawl100']);
  });

  it('brawl100 DeckFormatConfig is 99 singleton, 25 life 1v1, no commander damage', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const getFormatRules = mod?.getFormatRules as ((mode: string) => {
      deckSize?: number;
      singleton?: boolean;
      startingLife?: number;
      commanderDamage?: boolean;
      generation?: string;
      lifeCopy?: string;
    }) | undefined;
    const rules = typeof getFormatRules === 'function' ? getFormatRules('brawl100') : undefined;

    expect(rules).toMatchObject({
      deckSize: 99,
      singleton: true,
      startingLife: 25,
      commanderDamage: false,
      generation: 'implemented',
    });
    expect(rules?.lifeCopy).toMatch(/25/);
    expect(rules?.lifeCopy).toMatch(/1v1|1 v 1/i);
    expect(rules?.lifeCopy).toMatch(/no commander damage/i);
  });

  it('standardBrawl60 is removed from the product (no generation path)', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const getFormatRules = mod?.getFormatRules as ((mode: string) => { generation?: string }) | undefined;
    const generation = typeof getFormatRules === 'function'
      ? getFormatRules('standardBrawl60')?.generation
      : undefined;

    expect(generation, 'standardBrawl60 generation').toBe('removed');
    if (mod) {
      expect(mod.generateStandardBrawl60).toBeUndefined();
    }
  });

  it('commander rules stay 99 singleton with 40 life and commander damage', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const getFormatRules = mod?.getFormatRules as ((mode: string) => unknown) | undefined;
    const rules = typeof getFormatRules === 'function' ? getFormatRules('commander') : undefined;

    expect(rules).toMatchObject({
      deckSize: 99,
      singleton: true,
      startingLife: 40,
      commanderDamage: true,
      generation: 'implemented',
    });
  });

  it('brawl100 commanders are legendary creatures, planeswalkers, vehicles, or spacecraft', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const isEligible = mod?.isEligibleCommander as ((card: CardFace, mode: string) => boolean) | undefined;
    const eligible = (card: CardFace, mode: string) =>
      typeof isEligible === 'function' ? isEligible(card, mode) : undefined;

    const creature = face({ name: 'Adeline', type_line: 'Legendary Creature — Human Soldier', color_identity: ['W'] });
    const planeswalker = face({ name: 'Jace, the Mind Sculptor', type_line: 'Legendary Planeswalker — Jace', color_identity: ['U'] });
    const vehicle = face({ name: 'Shorikai', type_line: 'Legendary Artifact — Vehicle', color_identity: ['W', 'U'] });
    const spacecraft = face({ name: 'The Seriema', type_line: 'Legendary Artifact — Spacecraft', color_identity: ['W'] });
    const vanilla = face({ name: 'Grizzly Bears', type_line: 'Creature — Bear', color_identity: ['G'] });
    const nonLegendaryVehicle = face({ name: 'Smuggler\'s Copter', type_line: 'Artifact — Vehicle' });

    expect(eligible(creature, 'brawl100')).toBe(true);
    expect(eligible(planeswalker, 'brawl100')).toBe(true);
    expect(eligible(vehicle, 'brawl100')).toBe(true);
    expect(eligible(spacecraft, 'brawl100')).toBe(true);
    expect(eligible(vanilla, 'brawl100')).toBe(false);
    expect(eligible(nonLegendaryVehicle, 'brawl100')).toBe(false);
    // Paper Commander does not treat every planeswalker as a commander.
    expect(eligible(creature, 'commander')).toBe(true);
    expect(eligible(planeswalker, 'commander')).toBe(false);
    expect(eligible(vanilla, 'commander')).toBe(false);
  });

  it('brawl100 validation requires 1 commander + 99 singleton cards in color identity', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const validate = mod?.validateFormatDeck as ((input: {
      mode: string;
      commander: CardFace;
      cards: CardFace[];
    }) => { ok: boolean }) | undefined;
    const check = (cards: CardFace[], commander = whiteCommander()) =>
      typeof validate === 'function'
        ? validate({ mode: 'brawl100', commander, cards })
        : undefined;

    expect(check(pile(99, 'W'))?.ok).toBe(true);
    expect(check(pile(98, 'W'))?.ok).toBe(false);
    expect(check([...pile(98, 'W'), offColor()])?.ok).toBe(false);
    expect(check([...pile(98, 'W'), duplicateNonBasic()])?.ok).toBe(false);
  });

  it('commander validation still accepts a 99-card singleton in-identity pile', async () => {
    const mod = await tryLoadSeam(FORMAT_MODULE);
    const validate = mod?.validateFormatDeck as ((input: {
      mode: string;
      commander: CardFace;
      cards: CardFace[];
    }) => { ok: boolean }) | undefined;
    const result = typeof validate === 'function'
      ? validate({ mode: 'commander', commander: whiteCommander(), cards: pile(99, 'W') })
      : undefined;

    expect(result?.ok).toBe(true);
  });
});

function whiteCommander(): CardFace {
  return face({
    name: 'Adeline, Resplendent Cathar',
    type_line: 'Legendary Creature — Human Knight',
    color_identity: ['W'],
  });
}

function pile(count: number, color: string): CardFace[] {
  return Array.from({ length: count }, (_, index) => face({
    name: `White Spell ${index}`,
    type_line: 'Creature — Soldier',
    color_identity: [color],
  }));
}

function offColor(): CardFace {
  return face({ name: 'Llanowar Elves', type_line: 'Creature — Elf Druid', color_identity: ['G'] });
}

function duplicateNonBasic(): CardFace {
  return face({ name: 'White Spell 0', type_line: 'Creature — Soldier', color_identity: ['W'] });
}
