// Maps a WUBRG-sorted color-identity string to its guild/shard/wedge background
// name. Ported from the original SpellChroma; art lives in public/spellchroma-backgrounds/.
const GUILD_BY_IDENTITY: Record<string, string> = {
  WBG: 'abzan', WU: 'azorius', WUG: 'bant', WR: 'boros', UB: 'dimir',
  WBRG: 'dune-brood', WUB: 'esper', G: 'forest', UBRG: 'glint-eye',
  BG: 'golgari', UBR: 'grixis', RG: 'gruul', WURG: 'ink-treader',
  U: 'island', UR: 'izzet', WUR: 'jeskai', BRG: 'jund', WBR: 'mardu',
  R: 'mountain', WRG: 'naya', WB: 'orzhov', W: 'plains', BR: 'rakdos',
  WG: 'selesnya', UG: 'simic', UBG: 'sultai', B: 'swamp', URG: 'temur',
  WUBG: 'witch-maw', WUBR: 'yore-tiller', WUBRG: 'wubrg', '': 'wastes',
};

const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'];

/** Public URL of the backdrop art for a color identity (falls back to wastes). */
export function backgroundUrlForIdentity(colors: string[]): string {
  const set = new Set(colors);
  const key = WUBRG_ORDER.filter(c => set.has(c)).join('');
  const name = GUILD_BY_IDENTITY[key] ?? 'wastes';
  return `${import.meta.env.BASE_URL}spellchroma-backgrounds/${name}.png`;
}
