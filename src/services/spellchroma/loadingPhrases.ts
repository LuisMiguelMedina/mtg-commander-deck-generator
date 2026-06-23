// Flavor shown while the explorer is searching. Ported from the original
// SpellChroma (with its rare ~1% easter-egg quote kept intact).
export const LOADING_PHRASES = [
  'Tapping mana',
  'Summoning Saprolings',
  'Unstacking the stack',
  'Holding 2 blue mana',
  'Planeshifting',
  'Drawing a new hand',
  'Finding your new favorite',
  'Moving to main phase',
  'Shuffling Kozilek',
  'Rolling up the elves',
  'Flinging goblins',
  'Searching through grandpa\'s deck',
  'Bolting the 🐓',
  'Flying through the storm',
  'Blocking with squirrels',
  'Cooking with Asmoranomardicadaistinaculdacar',
  'Cooking with Gyome',
  'Cutting lands',
  'Paying the 1',
  'Hating bears',
  'Discovering something new',
  'Traversing the outlands',
  'Plowing the swords',
  'Almost there',
];

const RARE_PHRASES = [
  'Sh*tting on an iPhone',
];

/** A random flavor phrase — ~1% of the time it's a rare easter-egg quote. */
export function randomLoadingPhrase(): string {
  if (Math.floor(Math.random() * 100) === 0) {
    return RARE_PHRASES[Math.floor(Math.random() * RARE_PHRASES.length)];
  }
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}
