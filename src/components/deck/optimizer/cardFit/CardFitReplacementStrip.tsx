import type { ScryfallCard } from '@/types';
import { getCardImageUrl } from '@/services/scryfall/client';
import { scryfallImg } from '../constants';
import { getRoleBadgeProps } from '@/components/deck/roleBadge';

interface CardFitReplacementStripProps {
  candidates: ScryfallCard[];
  activeName: string | null;
  inclusionMap: Record<string, number>;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
}

export function CardFitReplacementStrip({
  candidates, activeName, inclusionMap, onSelect, onPreview,
}: CardFitReplacementStripProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-emerald-200 uppercase tracking-[0.22em] font-bold">
          Try instead
        </span>
        <span className="text-[10px] text-violet-300/60">
          · {candidates.length} candidate{candidates.length === 1 ? '' : 's'} · click to preview the swap, double-click to inspect
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {candidates.map(card => {
          const isActive = card.name === activeName;
          const inclusion = inclusionMap[card.name];
          const imgUrl = getCardImageUrl(card, 'small') ?? scryfallImg(card.name, 'small');
          const badge = getRoleBadgeProps(card);
          const cmc = typeof card.cmc === 'number' ? card.cmc : null;

          return (
            <div key={card.name} className="shrink-0 w-[100px]">
              <button
                type="button"
                onClick={() => onSelect(card.name)}
                onDoubleClick={() => onPreview(card.name)}
                className="block w-full text-left transition-transform hover:scale-[1.03]"
                title={`${card.name}${inclusion != null ? ` · ${inclusion.toFixed(0)}% inclusion` : ''}${badge ? ` · ${badge.title}` : ''}`}
              >
                <div
                  className="relative aspect-[5/7] rounded-md overflow-hidden"
                  style={{
                    boxShadow: isActive
                      ? '0 0 0 2px rgb(16,185,129), 0 8px 20px rgba(16,185,129,0.35)'
                      : '0 0 0 1px rgba(168,85,247,0.25)',
                  }}
                >
                  <img src={imgUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                  {cmc != null && (
                    <span
                      className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                      title={`Mana value ${cmc}`}
                    >
                      {cmc}
                    </span>
                  )}
                  {badge && (
                    <span
                      className={`absolute bottom-1 left-1 right-1 ${badge.bgColor} text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none text-center truncate`}
                      title={badge.title}
                    >
                      {badge.title}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[11px] text-white font-semibold truncate leading-tight">{card.name}</div>
                {inclusion != null ? (
                  <div className="text-[11px] text-emerald-300 font-bold mt-0.5">{inclusion.toFixed(0)}% included</div>
                ) : (
                  <div className="text-[10px] text-violet-300/50 italic mt-0.5">no data</div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
