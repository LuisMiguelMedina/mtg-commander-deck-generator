import { backgroundUrlForIdentity } from '@/services/spellchroma/colorBackground';

/**
 * Color-identity art behind the SpellChroma page — swaps with the active
 * identity (the loaded deck's, or the explorer's color toggle). Dimmed and
 * gradient-masked (lighter at the top, fading to near-solid at the bottom) so
 * it reads as a mood-setting backdrop without hurting card legibility.
 */
export function SpellChromaBackdrop({ colorIdentity }: { colorIdentity: string[] }) {
  const url = backgroundUrlForIdentity(colorIdentity);
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      <img
        key={url}
        src={url}
        alt=""
        className="w-full h-full object-cover opacity-[0.32] animate-fade-in"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/90" />
    </div>
  );
}
