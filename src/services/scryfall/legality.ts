type LegalityCard = {
  legalities?: Record<string, string>;
  games?: string[];
};

function passesArenaGate(card: LegalityCard, arenaOnly?: boolean): boolean {
  if (!arenaOnly) return true;
  return card.games?.includes('arena') ?? false;
}

export function isLegalForFormat(
  card: LegalityCard,
  mode: string,
  options?: { arenaOnly?: boolean },
): boolean {
  if (!passesArenaGate(card, options?.arenaOnly)) return false;

  if (mode === 'brawl100') {
    return card.legalities?.brawl === 'legal';
  }
  if (mode === 'commander') {
    return card.legalities?.commander === 'legal';
  }
  return false;
}

/** Historic Brawl deck building always uses the Arena card pool (`game:arena`). */
export function formatUsesArenaPool(mode: string): boolean {
  return mode === 'brawl100';
}

export function isLegalForFormatDeck(
  card: LegalityCard,
  mode: string,
  customizationArenaOnly?: boolean,
): boolean {
  const arenaOnly = formatUsesArenaPool(mode) || !!customizationArenaOnly;
  return isLegalForFormat(card, mode, { arenaOnly });
}
