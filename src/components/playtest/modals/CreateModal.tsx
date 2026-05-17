import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check } from 'lucide-react';
import { usePlaytestStore } from '@/store/playtestStore';
import { FloatingDialog } from '@/components/playtest/FloatingDialog';
import { COUNTER_COLORS, DIE_SIDES, type CounterColor, type DieSides } from '@/components/playtest/types';

// Polyhedral silhouettes (percent coords). Each is visually distinct — d10 is a
// kite (4 vertices), d12 is a pentagon (5 vertices), so they no longer collide.
const DIE_SHAPES: Record<DieSides, string> = {
  4:  'polygon(50% 4%, 96% 96%, 4% 96%)',
  6:  'polygon(8% 8%, 92% 8%, 92% 92%, 8% 92%)',
  8:  'polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)',
  10: 'polygon(50% 0%, 92% 38%, 50% 100%, 8% 38%)',
  12: 'polygon(50% 4%, 95% 38%, 78% 96%, 22% 96%, 5% 38%)',
  20: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
};

export function CreateModal() {
  const closeModal = usePlaytestStore(s => s.closeModal);
  const addFreeCounter = usePlaytestStore(s => s.addFreeCounter);
  const addFreeDie = usePlaytestStore(s => s.addFreeDie);

  const [color, setColor] = useState<CounterColor>('blue');
  const colorCfg = COUNTER_COLORS.find(c => c.key === color) ?? COUNTER_COLORS[0];

  return (
    <FloatingDialog
      title="Create"
      onClose={closeModal}
      storageKey="playtest:dialog-pos:create"
      width={320}
      headerExtra={
        <span className="ml-2 text-[10px] text-muted-foreground/70 hidden sm:inline">
          click · drag to place
        </span>
      }
    >
      <div className="px-4 py-3 space-y-3">
        {/* Color picker — additive selection (no dimming of unselected). */}
        <div className="flex items-center gap-1.5">
          {COUNTER_COLORS.map(c => {
            const active = color === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setColor(c.key)}
                title={c.label}
                aria-label={c.label}
                aria-pressed={active}
                className={`relative w-8 h-8 rounded-full ${c.chip} shadow-sm transition-transform duration-150 ${
                  active
                    ? `ring-2 ring-offset-2 ring-offset-card ${c.ring} scale-110`
                    : 'hover:scale-105'
                }`}
              >
                {active && (
                  <Check className="absolute inset-0 m-auto w-3.5 h-3.5 drop-shadow" strokeWidth={3} />
                )}
              </button>
            );
          })}
        </div>

        {/* Unified palette: counter + dice are siblings with identical weight. */}
        <div className="grid grid-cols-4 gap-2">
          <CounterTile
            color={color}
            chipClass={colorCfg.chip}
            ringClass={colorCfg.ring}
            onClick={() => addFreeCounter(color)}
          />
          {DIE_SIDES.map(n => (
            <DieTile
              key={n}
              sides={n}
              color={color}
              chipClass={colorCfg.chip}
              ringClass={colorCfg.ring}
              onClick={() => addFreeDie(n, undefined, color)}
            />
          ))}
        </div>
      </div>
    </FloatingDialog>
  );
}

const TILE_HEIGHT = 'h-[68px]';

function CounterTile({
  color, chipClass, ringClass, onClick,
}: {
  color: CounterColor;
  chipClass: string;
  ringClass: string;
  onClick: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `create-counter:${color}`,
    data: { createCounter: { color } },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title="Counter · click to spawn, drag to place"
      aria-label="Counter"
      className={`group relative ${TILE_HEIGHT} rounded-lg border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-all duration-150 touch-none flex flex-col items-center justify-center gap-1 ${
        isDragging ? 'opacity-0' : 'hover:-translate-y-0.5'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-md font-bold text-xs shadow ring-2 ${chipClass} ${ringClass}`}
        style={{ width: 24, height: 24 }}
        aria-hidden
      >
        1
      </div>
      <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        Counter
      </span>
    </button>
  );
}

function DieTile({
  sides, color, chipClass, ringClass, onClick,
}: {
  sides: DieSides;
  color: CounterColor;
  chipClass: string;
  ringClass: string;
  onClick: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `create-die:${sides}:${color}`,
    data: { createDie: { sides, color } },
  });
  const clip = { clipPath: DIE_SHAPES[sides] } as const;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title={`d${sides} · click to spawn, drag to place`}
      aria-label={`d${sides}`}
      className={`group relative ${TILE_HEIGHT} transition-transform duration-150 touch-none ${
        isDragging ? 'opacity-0' : 'hover:-translate-y-0.5'
      }`}
    >
      {/* Base color fill, clipped to the polygon. */}
      <span
        aria-hidden
        className={`absolute inset-0 ${chipClass} ${ringClass}`}
        style={clip}
      />
      {/* Top sheen — follows the polygon silhouette. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/0 to-transparent"
        style={clip}
      />
      {/* Bottom shade for depth. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-transparent"
        style={clip}
      />
      {/* Label */}
      <span className="relative z-10 flex items-center justify-center w-full h-full font-extrabold tabular-nums text-sm leading-none drop-shadow">
        d{sides}
      </span>
    </button>
  );
}
