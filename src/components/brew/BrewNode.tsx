import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getCardImageUrl } from '@/services/scryfall/client';
import type { BrewOption } from '@/services/brew/engine';

export function BrewNode({ onFinish }: { onFinish: () => void }) {
  const { brewNode, applyBrewOption, backToBrewFork, rerollBrew } = useStore();
  if (!brewNode) return null;

  const allShown = brewNode.options.flatMap(o => o.cards.map(c => c.name));
  // Packaged choices (a bundle, the lightning five, a multi-piece combo) render as a group of
  // smaller card images; a single-card choice renders one large "hero" card, Slay-the-Spire style.
  const packaged = brewNode.type === 'bundle' || brewNode.type === 'lightning'
    || (brewNode.options[0]?.cards.length ?? 0) > 1;
  const cardW = packaged ? 'w-[108px]' : 'w-[164px]';
  const imgSize = packaged ? 'small' : 'normal';

  function choose(option: BrewOption) {
    const taken = new Set(option.cards.map(c => c.name));
    const passed = allShown.filter(n => !taken.has(n));
    applyBrewOption(option, passed);
  }

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold tracking-tight mb-1">{brewNode.prompt}</h2>
      <p className="text-xs text-muted-foreground mb-7">
        {brewNode.type === 'bundle' ? 'Pick one package.'
          : brewNode.type === 'gamble' ? 'Take the bomb or pass.'
          : brewNode.type === 'combo' ? 'Add these pieces to complete the combo, or pass.'
          : brewNode.type === 'lightning' ? 'Add all five cards at once.'
          : 'Take one card.'}
      </p>

      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-7">
        {brewNode.options.map(option => (
          <button
            key={option.id}
            onClick={() => choose(option)}
            className="group flex flex-col items-center gap-2.5 rounded-2xl p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {option.label && (
              <div className="text-sm font-semibold text-violet-200">{option.label}</div>
            )}
            <div className="flex items-end justify-center gap-2.5">
              {option.cards.map((c, i) => (
                <div key={c.name} className={`${cardW} flex flex-col`}>
                  <img
                    src={getCardImageUrl(c.scryfall, imgSize)}
                    alt={c.name}
                    loading="lazy"
                    className="block w-full h-auto rounded-[4.8%] shadow-md ring-1 ring-black/50 transition duration-200 group-hover:-translate-y-2 group-hover:ring-violet-400/70 group-hover:shadow-[0_14px_34px_hsl(var(--primary)/0.45)]"
                  />
                  {(option.reasons[i] ?? []).length > 0 && (
                    <div
                      className="mt-1.5 w-full truncate text-[10px] leading-tight text-violet-300/90"
                      title={(option.reasons[i] ?? []).map(r => r.label).join(' · ')}
                    >
                      {(option.reasons[i] ?? []).map(r => r.label).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </button>
        ))}
        {brewNode.options.length === 0 && (
          <div className="text-sm text-muted-foreground py-10">
            No cards left for this route.{' '}
            <button className="text-violet-300 underline" onClick={onFinish}>Finish the deck</button> or go back.
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 mt-9">
        <Button variant="ghost" size="sm" onClick={backToBrewFork}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <span className="w-px h-4 bg-border" />
        <Button variant="ghost" size="sm" onClick={rerollBrew}><RefreshCw className="w-4 h-4 mr-1" /> Show different</Button>
        {brewNode.canPass && (<><span className="w-px h-4 bg-border" /><Button variant="ghost" size="sm" onClick={backToBrewFork}>Pass</Button></>)}
      </div>
    </div>
  );
}
