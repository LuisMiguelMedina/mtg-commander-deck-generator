export const FORMAT_MODES = ['commander', 'brawl100'] as const;
export type FormatMode = (typeof FORMAT_MODES)[number];

/** Scryfall inner query for Historic Brawl commanders on Arena (shared by search + top lists). */
export const BRAWL_ARENA_COMMANDER_SCRYFALL_QUERY =
  'game:arena legal:brawl -is:funny (is:commander OR (t:legendary t:planeswalker) OR "Legendary Artifact — Vehicle" OR "Legendary Artifact — Spacecraft")';

export type FormatRules = {
  deckSize: number;
  singleton: boolean;
  startingLife: number;
  commanderDamage: boolean;
  generation: 'implemented' | 'named-only' | 'removed';
  lifeCopy?: string;
};

type CardFace = {
  name: string;
  type_line: string;
  color_identity: string[];
};

const COMMANDER_RULES: FormatRules = {
  deckSize: 99,
  singleton: true,
  startingLife: 40,
  commanderDamage: true,
  generation: 'implemented',
};

const BRAWL100_RULES: FormatRules = {
  deckSize: 99,
  singleton: true,
  startingLife: 25,
  commanderDamage: false,
  generation: 'implemented',
  lifeCopy: '25 life 1v1 — no commander damage',
};

export function getFormatRules(mode: string): FormatRules | undefined {
  if (mode === 'commander') return { ...COMMANDER_RULES };
  if (mode === 'brawl100') return { ...BRAWL100_RULES };
  if (mode === 'standardBrawl60') {
    return {
      deckSize: 59,
      singleton: true,
      startingLife: 25,
      commanderDamage: false,
      generation: 'removed',
    };
  }
  return undefined;
}

function isLegendaryType(typeLine: string, suffix: string): boolean {
  return typeLine.includes('Legendary') && typeLine.includes(suffix);
}

export function isEligibleCommander(card: CardFace, mode: string): boolean {
  const typeLine = card.type_line ?? '';
  if (mode === 'commander') {
    return isLegendaryType(typeLine, 'Creature');
  }
  if (mode === 'brawl100') {
    return (
      isLegendaryType(typeLine, 'Creature')
      || isLegendaryType(typeLine, 'Planeswalker')
      || typeLine.includes('Legendary Artifact — Vehicle')
      || typeLine.includes('Legendary Artifact — Spacecraft')
    );
  }
  return false;
}

function colorsInIdentity(card: CardFace, commander: CardFace): boolean {
  const allowed = new Set(commander.color_identity ?? []);
  return (card.color_identity ?? []).every((color) => allowed.has(color));
}

function isSingletonViolation(cards: CardFace[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    const name = card.name.trim().toLowerCase();
    if (seen.has(name)) return true;
    seen.add(name);
  }
  return false;
}

export function validateFormatDeck(input: {
  mode: string;
  commander: CardFace;
  cards: CardFace[];
}): { ok: boolean } {
  const rules = getFormatRules(input.mode);
  if (!rules || rules.generation !== 'implemented') return { ok: false };
  if (input.cards.length !== rules.deckSize) return { ok: false };
  if (rules.singleton && isSingletonViolation(input.cards)) return { ok: false };
  if (!input.cards.every((card) => colorsInIdentity(card, input.commander))) return { ok: false };
  return { ok: true };
}
