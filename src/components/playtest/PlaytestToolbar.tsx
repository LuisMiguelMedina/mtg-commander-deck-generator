import { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlaytestStore } from '@/store/playtestStore';
import { PHASE_LABELS } from '@/components/playtest/types';

export function PlaytestToolbar({ onExit }: { onExit: () => void }) {
  const sourceName = usePlaytestStore(s => s.source?.name ?? '');
  const turn = usePlaytestStore(s => s.turn);
  const phase = usePlaytestStore(s => s.phase);
  const advancePhase = usePlaytestStore(s => s.advancePhase);
  const nextTurn = usePlaytestStore(s => s.nextTurn);
  const life = usePlaytestStore(s => s.life);
  const adjustLife = usePlaytestStore(s => s.adjustLife);
  const setLife = usePlaytestStore(s => s.setLife);

  const [editingLife, setEditingLife] = useState(false);
  const [draftLife, setDraftLife] = useState(String(life));

  const tinyBtn = 'px-1.5 py-0.5 rounded bg-accent/40 hover:bg-accent text-[10px] font-medium';

  return (
    <div className="border-b border-border/50 bg-card/50 backdrop-blur px-4 py-2 flex items-center gap-2 text-sm flex-wrap">
      <Button variant="ghost" size="sm" onClick={onExit}><X className="w-4 h-4 mr-1" />Exit</Button>
      <span className="text-muted-foreground/60">|</span>
      <span className="font-semibold">{sourceName}</span>
      <span className="text-muted-foreground/60">·</span>
      <button
        onClick={advancePhase}
        className="px-2 py-0.5 rounded bg-accent/40 hover:bg-accent text-xs font-medium"
        title="Advance phase (press 1–7 to jump to a specific phase)"
      >
        {PHASE_LABELS[phase]}
      </button>
      <button
        onClick={nextTurn}
        className="px-2 py-0.5 rounded hover:bg-accent/50 text-xs opacity-60 hover:opacity-100 transition"
        title="Click to advance to the next turn"
      >
        Turn {turn}
      </button>

      {/* Life cluster */}
      <div className="flex items-center gap-0.5 ml-2">
        <button onClick={() => adjustLife(-5)} className={tinyBtn} title="-5 life">−5</button>
        <button onClick={() => adjustLife(-1)} className={tinyBtn} title="-1 life">−1</button>
        {editingLife ? (
          <input
            autoFocus
            type="number"
            value={draftLife}
            onChange={e => setDraftLife(e.target.value)}
            onBlur={() => { setEditingLife(false); const n = parseInt(draftLife, 10); if (!isNaN(n)) setLife(n); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-14 mx-1 bg-emerald-500/15 border border-emerald-400/40 rounded px-1.5 py-0.5 text-emerald-300 font-bold text-center text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => { setDraftLife(String(life)); setEditingLife(true); }}
            className="mx-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold text-sm min-w-[48px] justify-center"
            title="Click to edit life"
          >
            <Heart className="w-3 h-3 fill-emerald-400/40" />
            {life}
          </button>
        )}
        <button onClick={() => adjustLife(1)} className={tinyBtn} title="+1 life">+1</button>
        <button onClick={() => adjustLife(5)} className={tinyBtn} title="+5 life">+5</button>
      </div>

      <span
        className="hidden lg:inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 ml-auto select-none"
        title="Hold Ctrl while hovering a card for a larger preview"
      >
        Hold <kbd className="px-1 py-0.5 rounded border border-border/60 bg-accent/30 font-mono text-[9px]">Ctrl</kbd>
        + hover to magnify
      </span>
    </div>
  );
}
