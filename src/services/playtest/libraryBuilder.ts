import type { ScryfallCard, UserCardList, GeneratedDeck } from '@/types';
import { getCardsByNames } from '@/services/scryfall/client';
import { fisherYates } from '@/components/playtest/utils';
import type { SourceInput, Zones } from '@/components/playtest/types';

export interface BuildResult {
  zones: Zones;
  commanderNames: string[];
  name: string;
  kind: 'list' | 'generated';
}

const EMPTY_ZONES: Zones = { library: [], hand: [], graveyard: [], exile: [], command: [] };

export async function buildLibrary(input: SourceInput): Promise<BuildResult> {
  if (input.kind === 'generated') {
    return buildFromGenerated(input.deck);
  }
  return buildFromList(input.list);
}

function buildFromGenerated(deck: GeneratedDeck): BuildResult {
  const command: ScryfallCard[] = [];
  if (deck.commander) command.push(deck.commander);
  if (deck.partnerCommander) command.push(deck.partnerCommander);

  const all = Object.values(deck.categories).flat();
  // Defensive: if commander somehow leaked into categories, drop it
  const commanderNamesSet = new Set(command.map(c => c.name));
  const libraryPool = all.filter(c => !commanderNamesSet.has(c.name));

  const library = fisherYates(libraryPool);

  return {
    zones: { ...EMPTY_ZONES, library, command },
    commanderNames: command.map(c => c.name),
    name: deck.commander?.name ?? 'Generated Deck',
    kind: 'generated',
  };
}

async function buildFromList(list: UserCardList): Promise<BuildResult> {
  const commanderNames: string[] = [];
  if (list.commanderName) commanderNames.push(list.commanderName);
  if (list.partnerCommanderName) commanderNames.push(list.partnerCommanderName);

  const allNames = Array.from(new Set([...list.cards, ...commanderNames]));
  const cardMap = await getCardsByNames(allNames);

  const command: ScryfallCard[] = [];
  for (const name of commanderNames) {
    const c = cardMap.get(name);
    if (c) command.push(c);
  }

  const commanderSet = new Set(commanderNames);
  // list.cards stores card NAMES with duplicates as repeated entries (no quantity field)
  const libraryPool: ScryfallCard[] = [];
  for (const name of list.cards) {
    if (commanderSet.has(name)) continue; // commanders go to command zone, not library
    const c = cardMap.get(name);
    if (c) libraryPool.push(c);
  }

  const library = fisherYates(libraryPool);

  return {
    zones: { ...EMPTY_ZONES, library, command },
    commanderNames,
    name: list.name,
    kind: 'list',
  };
}
