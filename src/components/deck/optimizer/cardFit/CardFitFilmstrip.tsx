import type { Misfit } from '@/types';
import { getCardImageUrl } from '@/services/scryfall/client';
import { scryfallImg } from '../constants';

interface CardFitFilmstripProps {
  featured: Misfit[];
  currentIndex: number;
  totalMisfits: number;
  onJump: (index: number) => void;
  onSeeAll: () => void;
}

function thumbStyle(distance: number): { width: number; opacity: number; saturate: number; scale: number } {
  if (distance === 0) return { width: 84, opacity: 1, saturate: 1, scale: 1 };
  if (distance === 1) return { width: 68, opacity: 0.75, saturate: 1, scale: 0.92 };
  if (distance === 2) return { width: 58, opacity: 0.55, saturate: 1, scale: 0.92 };
  return { width: 50, opacity: 0.35, saturate: 0.5, scale: 0.85 };
}

export function CardFitFilmstrip({
  featured, currentIndex, totalMisfits, onJump, onSeeAll,
}: CardFitFilmstripProps) {
  const longTail = Math.max(0, totalMisfits - featured.length);

  return (
    <div className="relative mt-8">
      <div
        className="absolute top-0 bottom-0 left-0 pointer-events-none z-10"
        style={{ width: 60, background: 'linear-gradient(90deg, #0f0a18, transparent)' }}
        aria-hidden
      />
      <div
        className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
        style={{ width: 60, background: 'linear-gradient(270deg, #0f0a18, transparent)' }}
        aria-hidden
      />
      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] font-bold mb-2">
        Up next · <b className="text-amber-300 font-bold">{featured.length} cards</b> in the lineup
      </div>
      <div className="flex gap-2.5 py-1 items-center overflow-hidden">
        {featured.map((m, i) => {
          const distance = Math.abs(i - currentIndex);
          const { width, opacity, saturate, scale } = thumbStyle(distance);
          const isActive = i === currentIndex;
          const imgUrl = getCardImageUrl(m.card, 'small') ?? scryfallImg(m.card.name, 'small');
          return (
            <button
              key={m.card.name}
              type="button"
              onClick={() => onJump(i)}
              className="relative shrink-0 rounded-md overflow-hidden transition-all"
              style={{
                width,
                aspectRatio: '5/7',
                opacity,
                filter: `saturate(${saturate})`,
                transform: `scale(${scale})`,
                boxShadow: isActive
                  ? '0 0 0 2px #a78bfa, 0 10px 24px rgba(168,85,247,0.5)'
                  : 'none',
              }}
              aria-label={`Jump to misfit ${i + 1}: ${m.card.name}`}
            >
              <img src={imgUrl} alt={m.card.name} className="w-full h-full object-cover" loading="lazy" />
              <span
                className="absolute bottom-0.5 left-0.5 text-white text-[8px] font-extrabold px-1.5 rounded-full"
                style={{ background: 'rgba(244,63,94,0.95)' }}
              >
                {m.reasons.length}
              </span>
            </button>
          );
        })}
        {longTail > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="shrink-0 text-violet-300 hover:text-violet-200 text-[10px] font-semibold px-3 ml-2 border-l border-violet-500/20 text-left"
          >
            + {longTail} more →
            <br />
            <span className="text-muted-foreground/60 font-normal">See full list</span>
          </button>
        )}
      </div>
    </div>
  );
}
