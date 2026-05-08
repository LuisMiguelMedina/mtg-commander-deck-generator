import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Hand as HandIcon,
  Trash2,
  Sparkles,
  Crown,
  ArrowUpToLine,
  ArrowDownToLine,
  EyeOff,
  Eye,
  Copy as CopyIcon,
  Repeat,
  Link2Off,
  RotateCcw,
} from 'lucide-react';
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

type Dest = 'hand' | 'graveyard' | 'exile' | 'command' | 'libtop' | 'libbot';

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

  const move = (dest: Dest) => {
    const source = onBattlefield && target.instanceId
      ? { kind: 'battlefield' as const, instanceId: target.instanceId }
      : { kind: 'zone' as const, zone: 'hand' as const, index: target.handIndex! };
    if (dest === 'libtop') moveCard({ source, target: { kind: 'library', position: 'top' } });
    else if (dest === 'libbot') moveCard({ source, target: { kind: 'library', position: 'bottom' } });
    else moveCard({ source, target: { kind: 'zone', zone: dest } });
    onClose();
  };

  // Hide "→ Hand" if the source is the hand (no-op move).
  const showHandDest = onBattlefield;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-[200] w-[260px] max-h-[80vh] overflow-y-auto bg-popover border border-border rounded-lg shadow-2xl text-xs"
      style={{
        left: adjusted ? adjusted.left : target.x,
        top: adjusted ? adjusted.top : target.y,
        visibility: adjusted ? 'visible' : 'hidden',
      }}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border/50">
        <div className="text-[13px] font-semibold leading-tight truncate">{target.card.name}</div>
        {typeLine && (
          <div className="text-[10px] text-muted-foreground/80 leading-tight truncate mt-0.5">
            {typeLine}
          </div>
        )}
      </div>

      {/* Primary: tap on battlefield */}
      {onBattlefield && bfCard && (
        <div className="px-2 pt-2">
          <button
            onClick={() => { toggleTap(bfCard.instanceId); onClose(); }}
            className={`w-full px-3 py-2 rounded-md text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors ${
              bfCard.tapped
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/40'
                : 'bg-primary/15 hover:bg-primary/25 text-primary-foreground/90 border border-primary/40'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${bfCard.tapped ? '' : 'rotate-90'}`} />
            {bfCard.tapped ? 'Untap' : 'Tap'}
          </button>
        </div>
      )}

      {/* Move destinations */}
      <div className="px-2 pt-2 pb-2">
        <SectionLabel>Move to</SectionLabel>
        <div className="grid grid-cols-3 gap-1">
          {showHandDest && <DestBtn icon={HandIcon}        label="Hand"      tone="emerald" onClick={() => move('hand')} />}
          <DestBtn icon={Trash2}      label="Graveyard" tone="zinc"    onClick={() => move('graveyard')} />
          <DestBtn icon={Sparkles}    label="Exile"     tone="amber"   onClick={() => move('exile')} />
          <DestBtn icon={Crown}       label="Command"   tone="purple"  onClick={() => move('command')} />
          <DestBtn icon={ArrowUpToLine}   label="Lib top"    tone="blue" onClick={() => move('libtop')} />
          <DestBtn icon={ArrowDownToLine} label="Lib bottom" tone="blue" onClick={() => move('libbot')} />
        </div>
      </div>

      {/* Card actions (battlefield only) */}
      {onBattlefield && bfCard && (
        <>
          <Divider />
          <div className="px-2 py-2">
            <SectionLabel>Card</SectionLabel>
            <div className="grid grid-cols-2 gap-1">
              {isDFC && (
                <ActionBtn
                  icon={Repeat}
                  onClick={() => { toggleFlipped(bfCard.instanceId); onClose(); }}
                >
                  {bfCard.flipped ? 'Front face' : 'Transform'}
                </ActionBtn>
              )}
              <ActionBtn
                icon={bfCard.faceDown ? Eye : EyeOff}
                onClick={() => { toggleFaceDown(bfCard.instanceId); onClose(); }}
              >
                {bfCard.faceDown ? 'Reveal' : 'Morph'}
              </ActionBtn>
              <ActionBtn
                icon={CopyIcon}
                onClick={() => { copyCard(bfCard.instanceId); onClose(); }}
              >
                Copy
              </ActionBtn>
              {isAttached && (
                <ActionBtn
                  icon={Link2Off}
                  onClick={() => { unattach(bfCard.instanceId); onClose(); }}
                >
                  Unattach
                </ActionBtn>
              )}
            </div>
          </div>

          <Divider />

          {/* Counter chips */}
          <div className="px-2 py-2">
            <SectionLabel>Add counter</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {COUNTER_CHIPS.map(c => (
                <button
                  key={c.key}
                  onClick={() => { adjustCounter(bfCard.instanceId, c.key, 1); onClose(); }}
                  className={`text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${c.cls}`}
                  title={`+1 ${c.key}`}
                >
                  +1 {c.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

const TONE_CLASSES: Record<string, string> = {
  emerald: 'text-emerald-300/90 hover:bg-emerald-500/15 hover:text-emerald-200',
  zinc:    'text-zinc-300/90 hover:bg-zinc-500/15 hover:text-zinc-200',
  amber:   'text-amber-300/90 hover:bg-amber-500/15 hover:text-amber-200',
  purple:  'text-purple-300/90 hover:bg-purple-500/15 hover:text-purple-200',
  blue:    'text-blue-300/90 hover:bg-blue-500/15 hover:text-blue-200',
};

function DestBtn({
  icon: Icon, label, tone, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: keyof typeof TONE_CLASSES;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-1.5 py-2 rounded-md border border-transparent transition-colors ${TONE_CLASSES[tone]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

function ActionBtn({
  icon: Icon, onClick, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-[11px] font-medium text-foreground/85"
    >
      <Icon className="w-3.5 h-3.5 opacity-70" />
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1 text-[9px] uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border/50 mx-2" />;
}
