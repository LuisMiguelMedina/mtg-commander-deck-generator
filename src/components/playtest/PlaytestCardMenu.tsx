import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlaytestStore } from '@/store/playtestStore';
import { isDoubleFacedCard, getFrontFaceTypeLine } from '@/services/scryfall/client';
import type { ScryfallCard } from '@/types';

export interface CardMenuTarget {
  // Either a battlefield card (instanceId set) or a hand card (handIndex set)
  kind: 'battlefield' | 'hand';
  instanceId?: string;
  handIndex?: number;
  card: ScryfallCard;
  x: number;
  y: number;
}

interface Props {
  target: CardMenuTarget | null;
  onClose: () => void;
}

const COUNTER_CHIPS: Array<{ key: string; label: string; cls: string }> = [
  { key: '+1/+1',   label: '+1/+1',   cls: 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/40' },
  { key: '-1/-1',   label: '-1/-1',   cls: 'bg-red-500/20 hover:bg-red-500/35 text-red-200 border-red-400/40' },
  { key: 'loyalty', label: 'Loyalty', cls: 'bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border-blue-400/40' },
  { key: 'charge',  label: 'Charge',  cls: 'bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-100 border-yellow-400/40' },
  { key: 'storage', label: 'Storage', cls: 'bg-zinc-500/20 hover:bg-zinc-500/35 text-zinc-200 border-zinc-400/40' },
];

export function PlaytestCardMenu({ target, onClose }: Props) {
  const moveCard = usePlaytestStore(s => s.moveCard);
  const toggleTap = usePlaytestStore(s => s.toggleTap);
  const toggleFaceDown = usePlaytestStore(s => s.toggleFaceDown);
  const toggleFlipped = usePlaytestStore(s => s.toggleFlipped);
  const adjustCounter = usePlaytestStore(s => s.adjustCounter);
  const copyCard = usePlaytestStore(s => s.copyCard);
  const unattach = usePlaytestStore(s => s.unattach);
  const battlefield = usePlaytestStore(s => s.battlefield);

  useEffect(() => {
    if (!target) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [target, onClose]);

  // Flip / clamp the menu so it stays on screen.
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!target || !menuRef.current) {
      setAdjusted(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = target.x;
    let top = target.y;
    if (left + rect.width + margin > vw) {
      left = Math.max(margin, target.x - rect.width);
    }
    if (top + rect.height + margin > vh) {
      top = Math.max(margin, target.y - rect.height);
    }
    left = Math.max(margin, Math.min(vw - rect.width - margin, left));
    top = Math.max(margin, Math.min(vh - rect.height - margin, top));
    setAdjusted({ left, top });
  }, [target]);

  if (!target) return null;

  const onBattlefield = target.kind === 'battlefield';
  const bfCard = onBattlefield && target.instanceId ? battlefield.find(b => b.instanceId === target.instanceId) : null;
  const isAttached = !!bfCard?.attachedTo;
  const isDFC = onBattlefield && bfCard ? isDoubleFacedCard(bfCard.card) : false;
  const typeLine = getFrontFaceTypeLine(target.card);

  const move = (dest: 'hand' | 'graveyard' | 'exile' | 'command' | 'libtop' | 'libbot') => {
    const source = onBattlefield && target.instanceId
      ? { kind: 'battlefield' as const, instanceId: target.instanceId }
      : { kind: 'zone' as const, zone: 'hand' as const, index: target.handIndex! };
    if (dest === 'libtop') moveCard({ source, target: { kind: 'library', position: 'top' } });
    else if (dest === 'libbot') moveCard({ source, target: { kind: 'library', position: 'bottom' } });
    else moveCard({ source, target: { kind: 'zone', zone: dest } });
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-[200] min-w-[200px] max-h-[80vh] overflow-y-auto bg-popover border border-border rounded-md shadow-2xl text-xs py-1"
      style={{
        left: adjusted ? adjusted.left : target.x,
        top: adjusted ? adjusted.top : target.y,
        visibility: adjusted ? 'visible' : 'hidden',
      }}
    >
      {/* Header */}
      <div className="px-3 pt-1.5 pb-1.5 border-b border-border/40 mb-1">
        <div className="text-[12px] font-semibold leading-tight truncate">{target.card.name}</div>
        {typeLine && (
          <div className="text-[10px] text-muted-foreground/80 leading-tight truncate">
            {typeLine}
          </div>
        )}
      </div>

      {onBattlefield && (
        <Item onClick={() => move('hand')}>→ Hand</Item>
      )}
      <Item onClick={() => move('libtop')}>→ Library Top</Item>
      <Item onClick={() => move('libbot')}>→ Library Bottom</Item>
      <Item onClick={() => move('graveyard')}>→ Graveyard</Item>
      <Item onClick={() => move('exile')}>→ Exile</Item>
      <Item onClick={() => move('command')}>→ Command Zone</Item>

      {onBattlefield && bfCard && (
        <>
          <Sep />
          <Item onClick={() => { toggleTap(bfCard.instanceId); onClose(); }}>{bfCard.tapped ? 'Untap' : 'Tap'}</Item>
          {isDFC && (
            <Item onClick={() => { toggleFlipped(bfCard.instanceId); onClose(); }}>
              {bfCard.flipped ? 'Show front face' : 'Transform / show back face'}
            </Item>
          )}
          <Item onClick={() => { toggleFaceDown(bfCard.instanceId); onClose(); }}>
            {bfCard.faceDown ? 'Flip face up' : 'Flip face down (morph)'}
          </Item>
          <Item onClick={() => { copyCard(bfCard.instanceId); onClose(); }}>Create copy</Item>
          {isAttached && <Item onClick={() => { unattach(bfCard.instanceId); onClose(); }}>Unattach</Item>}

          <Sep />
          <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase opacity-50">Add counter</div>
          <div className="px-2 pb-1.5 pt-1 flex flex-wrap gap-1">
            {COUNTER_CHIPS.map(c => (
              <button
                key={c.key}
                onClick={() => { adjustCounter(bfCard.instanceId, c.key, 1); onClose(); }}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${c.cls}`}
                title={`+1 ${c.key}`}
              >
                +1 {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors">{children}</button>;
}
function Sep() { return <div className="h-px bg-border/60 my-1" />; }
