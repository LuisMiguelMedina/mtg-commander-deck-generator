import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Undo2, RefreshCw, Play } from 'lucide-react';
import type { BrewRoute } from '@/services/brew/engine';

const TONE_CLASS: Record<string, string> = {
  need: 'border-destructive/40 text-[#fca5a5]',
  theme: 'border-[hsl(var(--success))]/40 text-emerald-300',
  neutral: 'border-violet-400/40 text-violet-200',
};

export function BrewPath({ onFinish }: { onFinish: () => void }) {
  const { brewState, brewRoutes, openBrewRoute, undoBrewPick, rerollBrew } = useStore();
  if (!brewState) return null;

  const pickNumber = brewState.history.length + 1;
  const canUndo = brewState.history.length > 0;

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-6 flex-wrap">
        {brewState.history.map((h, i) => (
          <span key={i} className="w-6 h-6 rounded-full border border-border bg-card grid place-items-center text-[10px] text-muted-foreground" title={h.added.join(', ')}>
            {h.added.length}
          </span>
        ))}
        <span className="w-8 h-8 rounded-full border border-violet-400 bg-primary/20 grid place-items-center text-violet-200 shadow-[0_0_18px_hsl(var(--primary)/0.4)]">●</span>
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Pick {pickNumber} · choose your route</div>
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Where to next?</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {brewRoutes.map((route: BrewRoute) => (
          <button
            key={route.id}
            onClick={() => (route.type === 'manabase' ? onFinish() : openBrewRoute(route))}
            className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 text-center transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-[0_0_30px_hsl(var(--primary)/0.22)]"
          >
            <h3 className="text-base font-semibold mb-1">{route.title}</h3>
            <p className="text-xs text-muted-foreground mb-3 min-h-[2.5rem]">{route.description}</p>
            {route.tag && (
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${TONE_CLASS[route.tone] ?? TONE_CLASS.neutral}`}>
                {route.tag}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1 mt-8">
        <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undoBrewPick}><Undo2 className="w-4 h-4 mr-1" /> Undo</Button>
        <span className="w-px h-4 bg-border" />
        <Button variant="ghost" size="sm" onClick={rerollBrew}><RefreshCw className="w-4 h-4 mr-1" /> Reroll routes</Button>
        <span className="w-px h-4 bg-border" />
        <Button variant="ghost" size="sm" className="text-violet-300" onClick={onFinish}><Play className="w-4 h-4 mr-1" /> Finish for me</Button>
      </div>
    </div>
  );
}
