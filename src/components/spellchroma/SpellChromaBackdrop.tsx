import { backgroundUrlForIdentity } from '@/services/spellchroma/colorBackground';

/**
 * Subtle color-identity art behind the SpellChroma page — swaps with the active
 * identity (the loaded deck's, or the explorer's color toggle). Heavily dimmed
 * and gradient-masked so it sets a mood without hurting card legibility.
 */
export function SpellChromaBackdrop({ colorIdentity }: { colorIdentity: string[] }) {
  const url = backgroundUrlForIdentity(colorIdentity);
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      <img
        key={url}
        src={url}
        alt=""
        className="w-full h-full object-cover opacity-[0.10] animate-fade-in"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/85 to-background" />
    </div>
  );
}
