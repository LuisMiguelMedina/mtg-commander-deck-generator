import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Undo2, RefreshCw, Play,
  Infinity as InfinityIcon, Zap, Dices, Mountain, TrendingUp, Crosshair, Bomb,
  BookOpen, PawPrint, Flame, ScrollText, Cog, Sparkles, UserRound, Swords, Package, Layers,
  type LucideIcon,
} from 'lucide-react';
import type { BrewRoute } from '@/services/brew/engine';

const TONE_CLASS: Record<string, string> = {
  need: 'border-destructive/40 text-[#fca5a5]',
  theme: 'border-[hsl(var(--success))]/40 text-emerald-300',
  neutral: 'border-violet-400/40 text-violet-200',
};

const TONE_RING: Record<string, string> = {
  need: 'border-destructive/50 text-[#fca5a5] bg-destructive/10',
  theme: 'border-[hsl(var(--success))]/50 text-emerald-300 bg-[hsl(var(--success))]/10',
  neutral: 'border-violet-400/50 text-violet-200 bg-violet-500/10',
};

// Role + card-type keys → symbol. Role and type keys are disjoint, so one map covers both.
const KEY_ICON: Record<string, LucideIcon> = {
  // roles
  ramp: TrendingUp, removal: Crosshair, boardwipe: Bomb, cardDraw: BookOpen,
  // card types
  creature: PawPrint, instant: Flame, sorcery: ScrollText, artifact: Cog,
  enchantment: Sparkles, planeswalker: UserRound, battle: Swords, land: Mountain,
};

/** Pick the at-a-glance symbol for a route (or a past pick), by move type then by what it fills. */
function iconFor(type: string, key: string | null): LucideIcon {
  if (type === 'combo') return InfinityIcon;
  if (type === 'lightning') return Zap;
  if (type === 'gamble') return Dices;
  if (type === 'manabase') return Mountain;
  if (key && KEY_ICON[key]) return KEY_ICON[key];
  return type === 'bundle' ? Package : Layers;
}

export function BrewPath({ onFinish }: { onFinish: () => void }) {
  const { brewState, brewRoutes, openBrewRoute, undoBrewPick, rerollBrew } = useStore();
  if (!brewState) return null;

  const pickNumber = brewState.history.length + 1;
  const canUndo = brewState.history.length > 0;

  return (
    <div className="text-center">
      {/* The path you've walked — a trail of the symbols you picked. */}
      <div className="flex items-center justify-center gap-1 mb-6 flex-wrap">
        {brewState.history.map((h, i) => {
          const key = h.routeId.includes(':') ? h.routeId.split(':')[1] : null;
          const Icon = iconFor(h.routeType, key);
          return (
            <span
              key={i}
              title={h.added.join(', ')}
              className="w-6 h-6 rounded-full border border-border bg-card grid place-items-center text-muted-foreground"
            >
              <Icon className="w-3 h-3" />
            </span>
          );
        })}
        <span className="w-8 h-8 rounded-full border border-violet-400 bg-primary/20 grid place-items-center text-violet-200 shadow-[0_0_18px_hsl(var(--primary)/0.4)]">●</span>
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Pick {pickNumber} · choose your route</div>
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Where to next?</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {brewRoutes.map((route: BrewRoute) => {
          const Icon = iconFor(route.type, route.targetRole ?? route.targetType ?? null);
          return (
            <button
              key={route.id}
              onClick={() => (route.type === 'manabase' ? onFinish() : openBrewRoute(route))}
              className="group rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 text-center transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-[0_0_30px_hsl(var(--primary)/0.22)]"
            >
              <div className={`mx-auto mb-3 w-14 h-14 rounded-full grid place-items-center border-2 transition-transform duration-150 group-hover:scale-110 ${TONE_RING[route.tone] ?? TONE_RING.neutral}`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold mb-1">{route.title}</h3>
              <p className="text-xs text-muted-foreground mb-3 min-h-[2.5rem]">{route.description}</p>
              {route.tag && (
                <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${TONE_CLASS[route.tone] ?? TONE_CLASS.neutral}`}>
                  {route.tag}
                </span>
              )}
            </button>
          );
        })}
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
