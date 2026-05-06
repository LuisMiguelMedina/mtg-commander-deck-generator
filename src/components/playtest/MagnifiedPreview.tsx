import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { getCardImageUrl } from '@/services/scryfall/client';
import type { ScryfallCard } from '@/types';

interface Props {
  card: ScryfallCard;
  anchorRef: RefObject<HTMLElement | null>;
  faceDown?: boolean;
}

const PREVIEW_WIDTH = 340;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * 1.396);
const GAP = 12;
const VIEWPORT_PAD = 8;

export function MagnifiedPreview({ card, anchorRef, faceDown }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = r.top - PREVIEW_HEIGHT - GAP;
      if (top < VIEWPORT_PAD) top = r.bottom + GAP;
      if (top + PREVIEW_HEIGHT > vh - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, vh - PREVIEW_HEIGHT - VIEWPORT_PAD);
      }
      let left = r.left + r.width / 2 - PREVIEW_WIDTH / 2;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - PREVIEW_WIDTH - VIEWPORT_PAD));
      setPos({ left, top });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [anchorRef]);

  if (!pos) return null;
  const src = faceDown ? `${import.meta.env.BASE_URL}card-back.png` : getCardImageUrl(card, 'large');

  return createPortal(
    <div
      className="fixed z-[200] pointer-events-none"
      style={{
        left: pos.left,
        top: pos.top,
        width: PREVIEW_WIDTH,
        opacity: shown ? 1 : 0,
        transform: shown ? 'scale(1)' : 'scale(0.92)',
        transformOrigin: 'center',
        transition: 'opacity 100ms ease-out, transform 100ms ease-out',
      }}
    >
      <img
        src={src}
        alt={card.name}
        className="w-full rounded-[12px] shadow-2xl ring-1 ring-black/40"
        draggable={false}
      />
    </div>,
    document.body,
  );
}
