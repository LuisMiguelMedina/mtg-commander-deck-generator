// src/components/deck/optimizer/dashboard/DeckShape.tsx
import type { ScryfallCard } from '@/types';

export interface DeckShapeProps {
  cards: ScryfallCard[];
  deckTarget: number;
  roleCounts: Record<string, number>;
  roleTargets: Record<string, number>;
  edhrecAvgCmc?: number | null;
  commanderName: string;
  sampleSize?: number | null;
}

function isLand(card: ScryfallCard): boolean {
  return card.type_line?.toLowerCase().includes('land') ?? false;
}

function deltaColor(delta: number, tolerance: number): string {
  const abs = Math.abs(delta);
  if (abs <= tolerance) return 'text-muted-foreground/70';
  if (abs <= tolerance * 2) return delta > 0 ? 'text-emerald-400/80' : 'text-amber-400/80';
  return delta > 0 ? 'text-emerald-400' : 'text-rose-400/90';
}

function deltaArrow(delta: number): string {
  return delta > 0 ? '▲' : '▼';
}

interface Tile {
  label: string;
  actual: string;
  typical: string;
  delta: number;
  tolerance: number;
}

export function DeckShape({
  cards,
  deckTarget,
  roleCounts,
  roleTargets,
  edhrecAvgCmc,
  commanderName,
  sampleSize,
}: DeckShapeProps) {
  const nonLands = cards.filter(c => !isLand(c));
  const deckAvgCmc =
    nonLands.length > 0
      ? nonLands.reduce((sum, c) => sum + (c.cmc ?? 0), 0) / nonLands.length
      : null;

  const tiles: Tile[] = [];

  // Card count
  tiles.push({
    label: 'Card count',
    actual: String(cards.length),
    typical: String(deckTarget),
    delta: cards.length - deckTarget,
    tolerance: 1,
  });

  // Avg CMC
  if (deckAvgCmc != null && edhrecAvgCmc != null) {
    tiles.push({
      label: 'Avg CMC',
      actual: deckAvgCmc.toFixed(2),
      typical: edhrecAvgCmc.toFixed(2),
      delta: parseFloat((deckAvgCmc - edhrecAvgCmc).toFixed(2)),
      tolerance: 0.1,
    });
  }

  // Ramp
  const rampActual = roleCounts['ramp'] ?? 0;
  const rampTarget = roleTargets['ramp'];
  if (rampTarget != null) {
    tiles.push({
      label: 'Ramp',
      actual: String(rampActual),
      typical: String(rampTarget),
      delta: rampActual - rampTarget,
      tolerance: 1,
    });
  }

  // Removal
  const removalActual = roleCounts['removal'] ?? 0;
  const removalTarget = roleTargets['removal'];
  if (removalTarget != null) {
    tiles.push({
      label: 'Removal',
      actual: String(removalActual),
      typical: String(removalTarget),
      delta: removalActual - removalTarget,
      tolerance: 1,
    });
  }

  if (tiles.length < 2) return null;

  const subtitle = sampleSize != null
    ? `vs typical ${commanderName} · ${sampleSize.toLocaleString()} decklists`
    : `vs typical ${commanderName}`;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
          How your build differs
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/60">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map(tile => {
          const absDelta = Math.abs(tile.delta);
          const showDelta = absDelta > 0;
          const sign = tile.delta > 0 ? '+' : '−';
          const color = deltaColor(tile.delta, tile.tolerance);
          return (
            <div
              key={tile.label}
              className="flex flex-col gap-1 rounded-md bg-muted/40 border border-border/30 px-3 py-2.5"
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                {tile.label}
              </span>
              <span className="text-xl font-black tabular-nums text-foreground leading-none">
                {tile.actual}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60">
                  vs {tile.typical}
                </span>
                {showDelta && (
                  <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
                    {deltaArrow(tile.delta)} {sign}{absDelta}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
