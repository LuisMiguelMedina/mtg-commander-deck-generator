import { ArrowRight, ChevronUp } from 'lucide-react';
import type { Misfit, ScryfallCard } from '@/types';
import { getCardImageUrl } from '@/services/scryfall/client';
import { scryfallImg } from '../constants';

interface CardFitFullListProps {
  open: boolean;
  onClose: () => void;
  misfits: Misfit[];
  onPreview: (cardName: string) => void;
  onRemove?: (card: ScryfallCard) => void;
  onAddReplacement?: (name: string) => void;
}

export function CardFitFullList({
  open, onClose, misfits, onPreview, onRemove, onAddReplacement,
}: CardFitFullListProps) {
  if (!open) return null;
  return (
    <section className="mt-6 rounded-xl border border-border/30 bg-card/40 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/80">
          All misfits <span className="text-foreground/90">· {misfits.length}</span>
        </h3>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 font-semibold transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" /> Hide
        </button>
      </div>
      <div className="space-y-2">
        {misfits.map(m => (
          <FullListRow
            key={m.card.name}
            misfit={m}
            onPreview={onPreview}
            onRemove={onRemove}
            onAddReplacement={onAddReplacement}
          />
        ))}
      </div>
    </section>
  );
}

function FullListRow({
  misfit, onPreview, onRemove, onAddReplacement,
}: {
  misfit: Misfit;
  onPreview: (name: string) => void;
  onRemove?: (card: ScryfallCard) => void;
  onAddReplacement?: (name: string) => void;
}) {
  const imgUrl = getCardImageUrl(misfit.card, 'small') ?? scryfallImg(misfit.card.name, 'small');
  return (
    <div className="flex items-stretch gap-3 p-2 rounded-lg border-l-2 border-l-rose-500/50 bg-rose-500/5">
      <button type="button" onClick={() => onPreview(misfit.card.name)} className="shrink-0">
        <img src={imgUrl} alt={misfit.card.name} className="w-12 h-16 rounded border border-rose-500/40 object-cover" loading="lazy" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{misfit.card.name}</div>
        <ul className="mt-1 space-y-0.5">
          {misfit.reasons.map((r, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">
              <span className="text-rose-400/90 font-medium">{r.label}</span> — {r.detail}
            </li>
          ))}
        </ul>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(misfit.card)}
            className="mt-1.5 text-[10px] text-rose-400 hover:text-rose-300"
          >
            Remove from deck
          </button>
        )}
      </div>
      {misfit.suggestedReplacement && (
        <div className="shrink-0 flex flex-col items-center justify-center text-center px-2 border-l border-border/30 ml-1">
          <ArrowRight className="w-3 h-3 text-violet-300/80 mb-1" />
          <button
            type="button"
            onClick={() => onPreview(misfit.suggestedReplacement!.name)}
            className="text-[10px] text-violet-300 font-semibold hover:text-violet-200 max-w-[100px] truncate"
            title={misfit.suggestedReplacement.name}
          >
            {misfit.suggestedReplacement.name}
          </button>
          {onAddReplacement && (
            <button
              type="button"
              onClick={() => onAddReplacement(misfit.suggestedReplacement!.name)}
              className="mt-1 text-[9px] text-emerald-400 hover:text-emerald-300"
            >
              + add
            </button>
          )}
        </div>
      )}
    </div>
  );
}
