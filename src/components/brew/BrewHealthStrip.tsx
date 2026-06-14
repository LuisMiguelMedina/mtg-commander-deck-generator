import { useStore } from '@/store';
import { buildHealth } from '@/services/brew/engine';
import { Sparkles } from 'lucide-react';

const ROLE_ROW: { key: 'ramp' | 'removal' | 'boardwipe' | 'cardDraw'; label: string }[] = [
  { key: 'ramp', label: 'Ramp' }, { key: 'removal', label: 'Removal' },
  { key: 'boardwipe', label: 'Wipes' }, { key: 'cardDraw', label: 'Draw' },
];

export function BrewHealthStrip() {
  const { brewContext, brewState } = useStore();
  if (!brewContext || !brewState) return null;
  const h = buildHealth(brewContext, brewState);

  function tone(current: number, target: number): string {
    if (target <= 0) return 'bg-muted-foreground/40';
    const ratio = current / target;
    if (ratio >= 0.9) return 'bg-[hsl(var(--success))]';
    if (ratio >= 0.4) return 'bg-amber-400';
    return 'bg-destructive';
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-2.5 flex items-center gap-4 flex-wrap text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-violet-200">
        <Sparkles className="w-3.5 h-3.5" /> Deck Score {h.deckScore}
      </span>
      {ROLE_ROW.map(r => (
        <span key={r.key} className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
          <span className={`w-1.5 h-1.5 rounded-full ${tone(h.roleCounts[r.key], h.roleTargets[r.key])}`} />
          {r.label} {h.roleCounts[r.key]}/{h.roleTargets[r.key]}
        </span>
      ))}
      <span className="text-muted-foreground/70 tabular-nums ml-auto">
        {h.cardCount} / {brewContext.nonLandTarget + brewContext.landTarget} · ${h.estCostUsd.toFixed(0)}
      </span>
    </div>
  );
}
