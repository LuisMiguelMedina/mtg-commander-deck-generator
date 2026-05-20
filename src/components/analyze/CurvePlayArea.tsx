// src/components/analyze/CurvePlayArea.tsx
import { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, BarChart3 } from 'lucide-react';
import type { ScryfallCard } from '@/types';
import { buildCurveBuckets } from './CurvePlayArea.buckets';
import { getCardImageUrl, getCardPrice } from '@/services/scryfall/client';
import { CardPreviewModal } from '@/components/ui/CardPreviewModal';

interface CurvePlayAreaProps {
  currentCards: ScryfallCard[];
  excludeNames?: Set<string>;
  onCmcSelect?: (cmc: number) => void;
}

const COLUMN_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

// Vertical 3px left-edge ribbon, not a top stripe — top stripes "scar" the fan.
const ROLE_RIBBON: Record<string, string> = {
  ramp:      'bg-emerald-500',
  removal:   'bg-rose-500',
  boardwipe: 'bg-orange-500',
  cardDraw:  'bg-sky-500',
};

const ROLE_LABEL: Record<string, string> = {
  ramp:      'Ramp',
  removal:   'Removal',
  boardwipe: 'Wipe',
  cardDraw:  'Draw',
};

// Role-priority sort uses the same cascade as the rest of the analyzer.
const ROLE_PRIORITY: Record<string, number> = {
  boardwipe: 0,
  removal:   1,
  ramp:      2,
  cardDraw:  3,
};

const COLOR_PRIORITY: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

type SortKey = 'name' | 'color' | 'role' | 'price';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name',  label: 'Name'  },
  { key: 'color', label: 'Color' },
  { key: 'role',  label: 'Role'  },
  { key: 'price', label: 'Price' },
];

function colorRank(card: ScryfallCard): number {
  const ci = card.color_identity || [];
  if (ci.length === 0) return 100; // colorless
  if (ci.length === 1) return COLOR_PRIORITY[ci[0]] ?? 50;
  return 50 + ci.length; // multicolor, ordered by # of colors
}

function sortBy(cards: ScryfallCard[], key: SortKey): ScryfallCard[] {
  const out = [...cards];
  if (key === 'name') {
    out.sort((a, b) => a.name.localeCompare(b.name));
  } else if (key === 'color') {
    out.sort((a, b) => {
      const d = colorRank(a) - colorRank(b);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  } else if (key === 'role') {
    out.sort((a, b) => {
      const ar = a.deckRole ? (ROLE_PRIORITY[a.deckRole] ?? 99) : 99;
      const br = b.deckRole ? (ROLE_PRIORITY[b.deckRole] ?? 99) : 99;
      return ar !== br ? ar - br : a.name.localeCompare(b.name);
    });
  } else if (key === 'price') {
    out.sort((a, b) => {
      const ap = parseFloat(getCardPrice(a) ?? '0');
      const bp = parseFloat(getCardPrice(b) ?? '0');
      return bp !== ap ? bp - ap : a.name.localeCompare(b.name);
    });
  }
  return out;
}

interface HoverState {
  card: ScryfallCard;
  anchor: { right: number; top: number; height: number };
}

const COLLAPSED_KEY = 'analyze-play-area-collapsed';
const LANDS_KEY = 'analyze-play-area-lands-expanded';
const SORT_STORAGE_KEY = 'analyze-play-area-sort';

export function CurvePlayArea({ currentCards, excludeNames, onCmcSelect }: CurvePlayAreaProps) {
  const buckets = useMemo(
    () => buildCurveBuckets(currentCards, { excludeNames }),
    [currentCards, excludeNames],
  );

  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [landsExpanded, setLandsExpanded] = useState<boolean>(() => localStorage.getItem(LANDS_KEY) === 'true');
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return (stored === 'name' || stored === 'color' || stored === 'role' || stored === 'price') ? stored : 'name';
  });

  useEffect(() => { localStorage.setItem(SORT_STORAGE_KEY, sortKey); }, [sortKey]);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };
  const toggleLands = () => {
    setLandsExpanded(prev => {
      const next = !prev;
      localStorage.setItem(LANDS_KEY, String(next));
      return next;
    });
  };

  // Apply the user's sort within each cell. Buckets keep their CMC × type
  // organization; we just re-order the cards inside.
  const sortedBuckets = useMemo(() => ({
    creatures: buckets.creatures.map(col => sortBy(col, sortKey)),
    noncreatures: buckets.noncreatures.map(col => sortBy(col, sortKey)),
    lands: buckets.lands.map(col => sortBy(col, sortKey)),
  }), [buckets, sortKey]);

  const [hover, setHover] = useState<HoverState | null>(null);
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);

  const handleHover = (card: ScryfallCard | null, e?: React.MouseEvent) => {
    if (card && e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHover({ card, anchor: { right: rect.right, top: rect.top, height: rect.height } });
    } else {
      setHover(null);
    }
  };

  const totalNonLand = buckets.countsByCmc.reduce((n, c) => n + c, 0);

  return (
    <div className="mb-2 border-y border-border/40">
      {/* Header — bigger, with sort selector */}
      <div className="flex items-center justify-between gap-3 px-2 sm:px-4 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-primary/70 shrink-0" />
          <span className="text-sm font-bold uppercase tracking-wider">Curve</span>
          <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
            <span className="text-foreground/80 font-semibold">{totalNonLand}</span> non-land
            {' · '}
            <span className="text-foreground/80 font-semibold">{buckets.landCount}</span> lands
          </span>
          {/* Role legend */}
          <div className="hidden md:flex items-center gap-2 ml-3 text-[10px] text-muted-foreground/70">
            {Object.entries(ROLE_LABEL).map(([key, label]) => (
              <span key={key} className="inline-flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-sm ${ROLE_RIBBON[key]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort button group */}
          {!collapsed && (
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {SORT_OPTIONS.map((opt, i) => {
                  const active = sortKey === opt.key;
                  return (
                    <div key={opt.key} className="contents">
                      {i > 0 && <div className="w-px h-3 bg-border/50" />}
                      <button
                        type="button"
                        onClick={() => setSortKey(opt.key)}
                        className={`text-[10px] px-2 py-0.5 transition-colors ${
                          active
                            ? 'bg-accent text-foreground font-medium'
                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-accent/50'
                        }`}
                        aria-pressed={active}
                      >
                        {opt.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={collapsed ? 'Expand play area' : 'Collapse play area'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="px-2 sm:px-4 py-2 grid grid-cols-8 gap-1 items-end h-12">
          {buckets.countsByCmc.map((count, i) => {
            const max = Math.max(...buckets.countsByCmc, 1);
            const heightPct = Math.max(8, Math.round((count / max) * 100));
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-primary/40 rounded-sm"
                  style={{ height: `${heightPct}%` }}
                  title={`CMC ${COLUMN_LABELS[i]}: ${count}`}
                />
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        // Outer wrapper caps the grid width and centers it. On ultrawide
        // screens this prevents columns from ballooning to 250px+ each.
        <div className="max-w-[1280px] mx-auto px-2 sm:px-4">
          {/* CMC column headers */}
          <div className="grid grid-cols-[72px_repeat(8,minmax(0,1fr))] gap-1 pt-2 text-[10px] text-muted-foreground/70">
            <div></div>
            {COLUMN_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onCmcSelect?.(i)}
                className="text-center font-medium tabular-nums py-1 rounded hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Filter analyzer to CMC ${label}`}
              >
                {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
              </button>
            ))}
          </div>

          <CurveRow label="Creatures" rowCards={sortedBuckets.creatures} onHover={handleHover} onSelect={setPreviewCard} onCmcSelect={onCmcSelect} />
          <CurveRow label="Non-creatures" rowCards={sortedBuckets.noncreatures} onHover={handleHover} onSelect={setPreviewCard} onCmcSelect={onCmcSelect} />

          <div className="border-t border-border/30">
            <button
              type="button"
              onClick={toggleLands}
              className="w-full grid grid-cols-[72px_repeat(8,minmax(0,1fr))] gap-1 py-2 items-center hover:bg-accent/20 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-expanded={landsExpanded}
            >
              <div className="text-[10px] uppercase tracking-wider text-foreground/70 font-semibold flex items-center gap-1">
                {landsExpanded
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />}
                Lands
              </div>
              <div className="col-span-8 text-xs text-muted-foreground/80">
                <span className="font-semibold text-foreground/80">{buckets.landCount}</span> lands
                {!landsExpanded && <span className="text-muted-foreground/50"> · click to expand</span>}
              </div>
            </button>
            {landsExpanded && (
              <CurveRow label="" rowCards={sortedBuckets.lands} onHover={handleHover} onSelect={setPreviewCard} />
            )}
          </div>
        </div>
      )}

      {/* Floating hover preview — hidden on small viewports */}
      {hover && (
        <div
          className="fixed z-[100] pointer-events-none hidden lg:block"
          style={{
            left: hover.anchor.right + 12,
            top: Math.min(Math.max(8, hover.anchor.top + hover.anchor.height / 2 - 180), window.innerHeight - 400),
          }}
        >
          <img
            src={getCardImageUrl(hover.card, 'normal') ?? ''}
            alt={hover.card.name}
            className="w-64 rounded-lg shadow-2xl border border-border/50"
          />
        </div>
      )}

      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
    </div>
  );
}

interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
  onSelect: (card: ScryfallCard) => void;
  onCmcSelect?: (cmc: number) => void;
}

function CurveRow({ label, rowCards, onHover, onSelect, onCmcSelect }: CurveRowProps) {
  return (
    <div className="grid grid-cols-[72px_repeat(8,minmax(0,1fr))] gap-1 py-1.5 items-end min-h-[180px]">
      {/* Row label as a chunky tag — readable, not a faint afterthought */}
      {label
        ? (
          <div className="self-stretch flex items-center pr-2 border-r border-border/30">
            <span className="text-[10px] uppercase tracking-wider text-foreground/75 font-semibold leading-tight">
              {label}
            </span>
          </div>
        )
        : <div />}
      {rowCards.map((col, i) => (
        <CurveCell key={i} cards={col} cmcIndex={i} onHover={onHover} onSelect={onSelect} onEmptyClick={onCmcSelect ? () => onCmcSelect(i) : undefined} />
      ))}
    </div>
  );
}

interface CurveCellProps {
  cards: ScryfallCard[];
  cmcIndex: number;
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
  onSelect: (card: ScryfallCard) => void;
  onEmptyClick?: () => void;
}

function CurveCell({ cards, cmcIndex, onHover, onSelect, onEmptyClick }: CurveCellProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (cards.length === 0) {
    if (!onEmptyClick) {
      return <div className="min-h-[140px]" />;
    }
    return (
      <button
        type="button"
        onClick={onEmptyClick}
        className="min-h-[140px] w-full rounded hover:bg-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Filter analyzer to CMC ${cmcIndex === 7 ? '7+' : cmcIndex} (empty column)`}
      />
    );
  }
  // Bigger, tighter Arena-style fan: 112px wide cards, 26px overlap so only
  // the top sliver of each upper card shows.
  const CARD_W = 112;
  const CARD_H = Math.round(CARD_W * 1.4);
  const OVERLAP = 26;
  const stackHeight = (cards.length - 1) * OVERLAP + CARD_H;
  return (
    <div className="relative mx-auto" style={{ width: `${CARD_W}px`, height: `${stackHeight}px` }}>
      {cards.map((card, idx) => {
        const ribbonClass = card.deckRole ? (ROLE_RIBBON[card.deckRole] ?? '') : '';
        const imgUrl = getCardImageUrl(card, 'small') ?? '';
        const isHovered = hoveredIdx === idx;
        return (
          <button
            key={card.name + idx}
            type="button"
            className="absolute left-0 right-0 transition-transform duration-150 hover:scale-[1.2] text-left w-full p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
            style={{ top: `${idx * OVERLAP}px`, zIndex: isHovered ? 50 : idx }}
            onClick={() => onSelect(card)}
            onMouseEnter={(e) => { setHoveredIdx(idx); onHover(card, e); }}
            onMouseLeave={() => { setHoveredIdx(null); onHover(null); }}
          >
            <img
              src={imgUrl}
              alt={card.name}
              className="w-full rounded shadow-md border border-border/40"
              loading="lazy"
              draggable={false}
              title={`${card.name}${card.deckRole ? ` · ${card.deckRole}` : ''}`}
            />
            {/* Role ribbon: vertical 3px stripe on the left edge.
                Much less intrusive than a top stripe in a fanned stack. */}
            {ribbonClass && (
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] z-10 ${ribbonClass} rounded-l`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
