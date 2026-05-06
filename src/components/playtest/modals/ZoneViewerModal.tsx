import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, X } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { usePlaytestStore } from '@/store/playtestStore';
import { getCardImageUrl } from '@/services/scryfall/client';
import { MagnifiedPreview } from '@/components/playtest/MagnifiedPreview';
import { useMagnifyKey } from '@/hooks/useMagnifyKey';
import type { ScryfallCard } from '@/types';
import type { ZoneKey } from '@/components/playtest/types';

const ZONE_LABEL: Record<string, string> = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile', command: 'Command Zone' };

type ZoneTargetKey = 'hand' | 'graveyard' | 'exile' | 'command' | 'libtop' | 'libbot';

interface ZoneCardTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
  card: ScryfallCard;
  dragAttributes: DraggableAttributes;
  dragListeners: Record<string, unknown> | undefined;
  isDragging: boolean;
}

const ZoneCardTrigger = forwardRef<HTMLButtonElement, ZoneCardTriggerProps>(
  function ZoneCardTrigger({ card, dragAttributes, dragListeners, isDragging, ...props }, ref) {
    const localRef = useRef<HTMLButtonElement | null>(null);
    const setRefs = (node: HTMLButtonElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    };
    const [hovered, setHovered] = useState(false);
    const magnify = useMagnifyKey();
    return (
      <button
        ref={setRefs}
        {...dragAttributes}
        {...(dragListeners as Record<string, unknown>)}
        {...props}
        onMouseEnter={(e) => { setHovered(true); props.onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHovered(false); props.onMouseLeave?.(e); }}
        className={`rounded-[5px] hover:ring-2 hover:ring-primary transition-all touch-none select-none ${isDragging ? 'opacity-0' : ''}`}
      >
        <img
          src={getCardImageUrl(card, 'small')}
          alt={card.name}
          className="w-full rounded-[5px] shadow pointer-events-none"
          draggable={false}
        />
        {magnify && hovered && !isDragging && <MagnifiedPreview card={card} anchorRef={localRef} />}
      </button>
    );
  },
);

export function ZoneViewerModal() {
  const modal = usePlaytestStore(s => s.modal);
  const zones = usePlaytestStore(s => s.zones);
  const closeModal = usePlaytestStore(s => s.closeModal);
  const moveCard = usePlaytestStore(s => s.moveCard);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(() => ({
    x: Math.max(40, (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2 - 300),
    y: 80,
  }));
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  // Hooks must run unconditionally — derive zone before bailing out below.
  const dialogZone: Exclude<ZoneKey, 'hand'> = modal && modal.kind === 'zoneViewer' ? modal.zone : 'graveyard';
  const droppable = useDroppable({
    id: `zone-viewer:${dialogZone}`,
    data: { kind: 'pile', zone: dialogZone },
  });

  useEffect(() => {
    if (!modal || modal.kind !== 'zoneViewer') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  const cardsForZone = modal && modal.kind === 'zoneViewer' ? zones[modal.zone] : [];

  const filtered = useMemo(() => {
    const indexed = cardsForZone.map((card, originalIndex) => ({ card, originalIndex }));
    const needle = q.toLowerCase().trim();
    if (!needle) return indexed;
    return indexed.filter(({ card }) =>
      card.name.toLowerCase().includes(needle) ||
      card.type_line.toLowerCase().includes(needle),
    );
  }, [cardsForZone, q]);

  if (!modal || modal.kind !== 'zoneViewer') return null;
  const zone = modal.zone;
  const cards = cardsForZone;

  const startHeaderDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const onMove = (ev: PointerEvent) => {
      if (!dragOffset.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPos({
        x: Math.max(-40, Math.min(w - 200, ev.clientX - dragOffset.current.dx)),
        y: Math.max(0, Math.min(h - 60, ev.clientY - dragOffset.current.dy)),
      });
    };
    const onUp = () => {
      dragOffset.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const moveTo = (idx: number, target: ZoneTargetKey) => {
    const source: { kind: 'zone'; zone: Exclude<ZoneKey, 'hand'>; index: number } = { kind: 'zone', zone, index: idx };
    if (target === 'libtop') moveCard({ source, target: { kind: 'library', position: 'top' } });
    else if (target === 'libbot') moveCard({ source, target: { kind: 'library', position: 'bottom' } });
    else moveCard({ source, target: { kind: 'zone', zone: target } });
  };

  return createPortal(
    <div
      ref={droppable.setNodeRef}
      className={`fixed z-[150] bg-card border rounded-lg shadow-2xl w-[600px] max-w-[90vw] max-h-[70vh] flex flex-col ${droppable.isOver ? 'border-primary ring-2 ring-primary/60' : 'border-border'}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={startHeaderDrag}
        className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 opacity-50 shrink-0" />
          <h2 className="text-sm font-semibold truncate">
            {ZONE_LABEL[zone]}
            <span className="text-muted-foreground font-normal ml-1.5">
              ({filtered.length}{filtered.length !== cards.length ? ` of ${cards.length}` : ''})
            </span>
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={closeModal} title="Close (Esc)">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 py-2 border-b border-border/40">
        <Input
          placeholder="Search by name or type…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-10">
            {cards.length === 0 ? `${ZONE_LABEL[zone]} is empty. Drag cards here to add them.` : 'No cards match the filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {filtered.map(({ card, originalIndex }) => (
              <ViewerCard
                key={`${card.id}-${originalIndex}`}
                card={card}
                originalIndex={originalIndex}
                zone={zone}
                onMoveTo={moveTo}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ViewerCardProps {
  card: ScryfallCard;
  originalIndex: number;
  zone: Exclude<ZoneKey, 'hand'>;
  onMoveTo: (idx: number, target: ZoneTargetKey) => void;
}

function ViewerCard({ card, originalIndex, zone, onMoveTo }: ViewerCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `viewer:${zone}:${originalIndex}:${card.id}`,
    data: { source: { kind: 'zone', zone, index: originalIndex } },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ZoneCardTrigger
          ref={setNodeRef}
          card={card}
          dragAttributes={attributes}
          dragListeners={listeners}
          isDragging={isDragging}
          title={card.name}
        />
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'hand')}>To Hand</Button>
        {zone !== 'library' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'libtop')}>To Library Top</Button>}
        {zone !== 'library' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'libbot')}>To Library Bottom</Button>}
        {zone !== 'graveyard' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'graveyard')}>To Graveyard</Button>}
        {zone !== 'exile' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'exile')}>To Exile</Button>}
        {zone !== 'command' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMoveTo(originalIndex, 'command')}>To Command Zone</Button>}
      </PopoverContent>
    </Popover>
  );
}
