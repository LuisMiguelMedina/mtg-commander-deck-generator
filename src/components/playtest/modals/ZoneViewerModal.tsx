import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import { usePlaytestStore } from '@/store/playtestStore';
import { getCardImageUrl } from '@/services/scryfall/client';
import { MagnifiedPreview } from '@/components/playtest/MagnifiedPreview';
import { FloatingDialog } from '@/components/playtest/FloatingDialog';
import { PlaytestCardMenu, type CardMenuTarget } from '@/components/playtest/PlaytestCardMenu';
import { useMagnifyKey } from '@/hooks/useMagnifyKey';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ScryfallCard } from '@/types';
import type { ZoneKey } from '@/components/playtest/types';

const ZONE_LABEL: Record<string, string> = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile', command: 'Command Zone' };

interface ZoneCardTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
  card: ScryfallCard;
  dragAttributes: DraggableAttributes;
  dragListeners: Record<string, unknown> | undefined;
  isDragging: boolean;
}

const ZoneCardTrigger = forwardRef<HTMLButtonElement, ZoneCardTriggerProps>(
  function ZoneCardTrigger({ card, dragAttributes, dragListeners, isDragging, className: extraClassName, ...props }, ref) {
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
        className={`rounded-[5px] hover:ring-2 hover:ring-primary transition-all touch-none select-none ${isDragging ? 'opacity-0' : ''} ${extraClassName ?? ''}`}
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
  const [menu, setMenu] = useState<CardMenuTarget | null>(null);
  const isMobile = !useMediaQuery('(min-width: 768px)');

  // Hooks must run unconditionally — derive zone before bailing out below.
  const dialogZone: Exclude<ZoneKey, 'hand'> = modal && modal.kind === 'zoneViewer' ? modal.zone : 'graveyard';
  const droppable = useDroppable({
    id: `zone-viewer:${dialogZone}`,
    data: { kind: 'pile', zone: dialogZone, floating: true },
  });

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

  // Re-filter when modal closes/reopens? Reset filter on zone change.
  useEffect(() => { setQ(''); }, [dialogZone]);

  if (!modal || modal.kind !== 'zoneViewer') return null;
  const zone = modal.zone;
  const cards = cardsForZone;

  const title = (
    <>
      {ZONE_LABEL[zone]}
      <span className="text-muted-foreground font-normal ml-1.5">
        ({filtered.length}{filtered.length !== cards.length ? ` of ${cards.length}` : ''})
      </span>
    </>
  );

  return (
    <FloatingDialog
      title={title}
      onClose={closeModal}
      storageKey={`playtest:dialog-pos:zone-viewer:${zone}`}
      sizeStorageKey={`playtest:dialog-size:zone-viewer:${zone}`}
      resizable
      outerRef={droppable.setNodeRef}
      outerClassName={droppable.isOver ? 'border-primary ring-2 ring-primary/60' : ''}
    >
      <div className="px-4 py-2 border-b border-border/40">
        <Input
          placeholder="Search by name or type…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-10">
            {cards.length === 0 ? `${ZONE_LABEL[zone]} is empty. Drag cards here to add them.` : 'No cards match the filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
            {filtered.map(({ card, originalIndex }) => (
              <ViewerCard
                key={`${card.id}-${originalIndex}`}
                card={card}
                originalIndex={originalIndex}
                zone={zone}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ kind: 'zone', zone, zoneIndex: originalIndex, card, x: e.clientX, y: e.clientY });
                }}
                // Mobile only: tap to play the card straight to the battlefield.
                onTap={isMobile ? () => {
                  moveCard({
                    source: { kind: 'zone', zone, index: originalIndex },
                    target: { kind: 'battlefield', x: 50, y: 0, arrived: true },
                  });
                  closeModal();
                } : undefined}
              />
            ))}
          </div>
        )}
      </div>
      <PlaytestCardMenu target={menu} onClose={() => setMenu(null)} />
    </FloatingDialog>
  );
}

interface ViewerCardProps {
  card: ScryfallCard;
  originalIndex: number;
  zone: Exclude<ZoneKey, 'hand'>;
  onContextMenu: (e: React.MouseEvent) => void;
  /** Optional tap-to-play handler (mobile only). Drag still wins via dnd-kit's
   *  activation threshold — a real swipe starts the drag instead of firing this. */
  onTap?: () => void;
}

function ViewerCard({ card, originalIndex, zone, onContextMenu, onTap }: ViewerCardProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `viewer:${zone}:${originalIndex}:${card.id}`,
    data: { source: { kind: 'zone', zone, index: originalIndex } },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `viewer-slot:${zone}:${originalIndex}`,
    data: { kind: 'zone-card-slot', zone, index: originalIndex },
  });
  const composedRef = (node: HTMLButtonElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <ZoneCardTrigger
      ref={composedRef}
      card={card}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
      title={onTap ? `${card.name} · tap to play · long-press for options` : `${card.name} · right-click for options · drag to reorder`}
      onClick={onTap}
      onContextMenu={onContextMenu}
      className={isOver && !isDragging ? 'ring-2 ring-primary' : undefined}
    />
  );
}
