# Curve Play Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the current deck as an Arena-style fanned card grid above the analyzer on `/analyze` — CMC columns × Creature/Non-creature/Lands rows — with role-colored stripes on each card slot. Clicking a column jumps the analyzer to its Curve tab focused on that CMC.

**Architecture:** New component `CurvePlayArea` mounted on `/analyze` between the `CommanderStrip` and the `DeckOptimizer`. Pure projection of the Zustand `generatedDeck.categories` — no new card metadata, no new computation, no analyzer-internal changes beyond accepting one prop and extending one event payload.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Lucide. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-19-curve-play-area-design.md](../specs/2026-05-19-curve-play-area-design.md)

---

## Verification Convention

The project does not have a unit test framework configured. Every task verifies via:

1. `npm run build` — `tsc -b && vite build` must succeed (lint is broken at the config level — pre-existing — skip it).
2. **Manual smoke** — task-specific behavior to exercise in `npm run dev` (`http://localhost:5173/mtg-commander-deck-generator/`).
3. **Commit** with the message shown in the task.

When a task says "Build+smoke" — do not skip these. They replace the automated test step.

---

## File Structure

**New files:**

```
src/components/analyze/
  CurvePlayArea.buckets.ts   # buildCurveBuckets pure helper + types
  CurvePlayArea.tsx          # the component
```

**Modified:**

```
src/pages/AnalyzePage.tsx                         # mount CurvePlayArea, hide during optimize view
src/components/deck/optimizer/DeckOptimizer.tsx   # accept initialSelectedCmc prop; broadcast optimizeView in state event
src/components/deck/optimizer/constants.ts        # add initialSelectedCmc to DeckOptimizerProps
src/data/patchNotes.json                          # 1.3.1 entry
package.json                                      # 1.3.0 → 1.3.1
```

**Untouched (deliberate):**

- `src/components/deck/optimizer/CurveTab.tsx` — its existing `selectedCmc` handling is reused unchanged.
- `src/services/scryfall/client.ts` — `isAnyLand` and `getFrontFaceTypeLine` already exported.
- `src/services/deckBuilder/deckEnricher.ts` — `deckRole` stamping unchanged.

---

## Task 1: Create `buildCurveBuckets` pure helper

**Files:**
- Create: `src/components/analyze/CurvePlayArea.buckets.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/components/analyze/CurvePlayArea.buckets.ts
import { isAnyLand, getFrontFaceTypeLine } from '@/services/scryfall/client';
import type { ScryfallCard } from '@/types';

export interface CurveBuckets {
  /** Indexed by CMC 0..7 (column 7 = "7+"). Inner arrays sorted alphabetically. */
  creatures: ScryfallCard[][];
  noncreatures: ScryfallCard[][];
  /** All lands in lands[0] — CMC has no meaningful column position for lands. */
  lands: ScryfallCard[][];
  /** length 8 — sum of creatures[i].length + noncreatures[i].length per column. */
  countsByCmc: number[];
  landCount: number;
}

export interface BuildCurveBucketsOptions {
  /** Card names to exclude from the buckets (commanders show in CommanderStrip, not here). */
  excludeNames?: Set<string>;
}

const COLUMN_COUNT = 8; // CMC 0,1,2,3,4,5,6,7+

export function buildCurveBuckets(
  cards: ScryfallCard[],
  opts: BuildCurveBucketsOptions = {},
): CurveBuckets {
  const exclude = opts.excludeNames ?? new Set<string>();

  const creatures: ScryfallCard[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  const noncreatures: ScryfallCard[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  const lands: ScryfallCard[][] = Array.from({ length: COLUMN_COUNT }, () => []);

  for (const card of cards) {
    if (exclude.has(card.name)) continue;

    if (isAnyLand(card)) {
      lands[0].push(card);
      continue;
    }

    const cmc = Math.min(Math.floor(card.cmc ?? 0), COLUMN_COUNT - 1);
    const typeLine = getFrontFaceTypeLine(card).toLowerCase();
    if (typeLine.includes('creature')) {
      creatures[cmc].push(card);
    } else {
      noncreatures[cmc].push(card);
    }
  }

  const sortByName = (a: ScryfallCard, b: ScryfallCard) => a.name.localeCompare(b.name);
  creatures.forEach(col => col.sort(sortByName));
  noncreatures.forEach(col => col.sort(sortByName));
  lands.forEach(col => col.sort(sortByName));

  const countsByCmc = creatures.map((col, i) => col.length + noncreatures[i].length);
  const landCount = lands.reduce((n, col) => n + col.length, 0);

  return { creatures, noncreatures, lands, countsByCmc, landCount };
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.buckets.ts
git commit -m "feat(analyze): buildCurveBuckets helper for play area"
```

---

## Task 2: Render the `CurvePlayArea` skeleton (rows, columns, counts)

This task renders the static structure (3 rows × 8 columns, counts, headers) with no card art, no interactivity, no fan, no role colors. We'll layer those in subsequent tasks.

**Files:**
- Create: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/analyze/CurvePlayArea.tsx
import { useMemo } from 'react';
import type { ScryfallCard } from '@/types';
import { buildCurveBuckets } from './CurvePlayArea.buckets';

interface CurvePlayAreaProps {
  currentCards: ScryfallCard[];
  excludeNames?: Set<string>;
}

const COLUMN_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

export function CurvePlayArea({ currentCards, excludeNames }: CurvePlayAreaProps) {
  const buckets = useMemo(
    () => buildCurveBuckets(currentCards, { excludeNames }),
    [currentCards, excludeNames],
  );

  return (
    <div className="mb-2 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Curve</span>
        <span className="text-[11px] text-muted-foreground/60">
          {buckets.countsByCmc.reduce((n, c) => n + c, 0)} non-land · {buckets.landCount} lands
        </span>
      </div>

      {/* CMC column headers */}
      <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 pt-2 text-[10px] text-muted-foreground/70">
        <div></div>
        {COLUMN_LABELS.map((label, i) => (
          <div key={i} className="text-center font-medium tabular-nums">
            {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
          </div>
        ))}
      </div>

      {/* Creatures row */}
      <CurveRow label="Creatures" rowCards={buckets.creatures} />

      {/* Non-creatures row */}
      <CurveRow label="Non-creatures" rowCards={buckets.noncreatures} />

      {/* Lands row (collapsed summary for now — Task 8 will add expand) */}
      <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-1.5 border-t border-border/20 items-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Lands</div>
        <div className="col-span-8 text-[11px] text-muted-foreground/60">{buckets.landCount} lands</div>
      </div>
    </div>
  );
}

interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
}

function CurveRow({ label, rowCards }: CurveRowProps) {
  return (
    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-2 items-end min-h-[80px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      {rowCards.map((col, i) => (
        <div key={i} className="text-center text-[10px] text-muted-foreground/50">
          {col.length > 0 ? `${col.length}` : ''}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Mount it temporarily on AnalyzePage to smoke-test**

In `src/pages/AnalyzePage.tsx`, add the import near the other `@/components/analyze/...` imports:

```tsx
import { CurvePlayArea } from '@/components/analyze/CurvePlayArea';
```

Inside the `if (deckLoaded) { return (...) }` branch, add the play area just before the `<DeckOptimizer>`:

```tsx
{generatedDeck.commander && (
  <>
    <CurvePlayArea
      currentCards={Object.values(generatedDeck.categories).flat()}
      excludeNames={(() => {
        const s = new Set<string>();
        if (generatedDeck.commander) s.add(generatedDeck.commander.name);
        if (generatedDeck.partnerCommander) s.add(generatedDeck.partnerCommander.name);
        return s;
      })()}
    />
    <DeckOptimizer
      commanderName={generatedDeck.commander.name}
      ...
```

(Keep the existing `<DeckOptimizer ... />` block; just wrap it and the new `<CurvePlayArea>` in a `<>` fragment.)

- [ ] **Step 3: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Visit `/analyze` and load a deck (paste, list, or generate).
- See a "CURVE" card above the analyzer with two rows (Creatures, Non-creatures), 8 CMC column headers with counts, and a lands summary at the bottom.
- Column counts should make sense for the loaded deck.

- [ ] **Step 4: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): CurvePlayArea skeleton above the analyzer"
```

---

## Task 3: Render fanned card art with role stripes

This task replaces the count-only `CurveRow` cells with actual fanned card slots and adds the role-color stripe.

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Add the fanned slot rendering**

Replace the `CurveRow` component in `src/components/analyze/CurvePlayArea.tsx` with this version:

```tsx
import { getCardImageUrl } from '@/services/scryfall/client';

const ROLE_STRIPE: Record<string, string> = {
  ramp:      'bg-emerald-500',
  removal:   'bg-rose-500',
  boardwipe: 'bg-orange-500',
  cardDraw:  'bg-sky-500',
};

interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
}

function CurveRow({ label, rowCards }: CurveRowProps) {
  return (
    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-2 items-end min-h-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 self-center">{label}</div>
      {rowCards.map((col, i) => (
        <CurveCell key={i} cards={col} />
      ))}
    </div>
  );
}

interface CurveCellProps {
  cards: ScryfallCard[];
}

function CurveCell({ cards }: CurveCellProps) {
  if (cards.length === 0) {
    return <div className="min-h-[100px]" />;
  }
  // Fan: each card offset down from the previous so only a thin slice of
  // upper cards is visible. The last card in the array is shown fully.
  const OVERLAP = 18; // px each card peeks below the previous
  return (
    <div className="relative" style={{ height: `${(cards.length - 1) * OVERLAP + 90}px` }}>
      {cards.map((card, idx) => {
        const stripeClass = card.deckRole ? (ROLE_STRIPE[card.deckRole] ?? '') : '';
        const imgUrl = getCardImageUrl(card, 'small') ?? '';
        return (
          <div
            key={card.name + idx}
            className="absolute left-0 right-0"
            style={{ top: `${idx * OVERLAP}px`, zIndex: idx }}
          >
            {stripeClass && <div className={`absolute top-0 left-0 right-0 h-[3px] z-10 ${stripeClass} rounded-t`} />}
            <img
              src={imgUrl}
              alt={card.name}
              className="w-full rounded shadow-md border border-border/40"
              loading="lazy"
              draggable={false}
              title={`${card.name}${card.deckRole ? ` · ${card.deckRole}` : ''}`}
            />
          </div>
        );
      })}
    </div>
  );
}
```

(Keep the rest of `CurvePlayArea.tsx` as-is from Task 2.)

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Load a deck on `/analyze`.
- Each populated column shows fanned card art (small images stacked with slight vertical offset).
- Ramp cards have a green top stripe, removal red, wipes orange, draw sky-blue.
- Empty columns stay blank.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx
git commit -m "feat(analyze): fanned card art with role-color stripes"
```

---

## Task 4: Hover preview (floating large image)

Mirrors the `ListDeckView` floating preview pattern: when hovering a card slot, show a larger image floating to the right of the column.

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Lift hover state and add the floating preview**

In `src/components/analyze/CurvePlayArea.tsx`, add a hover state at the top component and pass a handler down to `CurveCell`:

Replace the existing top component body with this:

```tsx
import { useMemo, useState } from 'react';
import type { ScryfallCard } from '@/types';
import { buildCurveBuckets } from './CurvePlayArea.buckets';
import { getCardImageUrl } from '@/services/scryfall/client';

interface CurvePlayAreaProps {
  currentCards: ScryfallCard[];
  excludeNames?: Set<string>;
}

const COLUMN_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

interface HoverState {
  card: ScryfallCard;
  anchor: { right: number; top: number; height: number };
}

export function CurvePlayArea({ currentCards, excludeNames }: CurvePlayAreaProps) {
  const buckets = useMemo(
    () => buildCurveBuckets(currentCards, { excludeNames }),
    [currentCards, excludeNames],
  );
  const [hover, setHover] = useState<HoverState | null>(null);

  const handleHover = (card: ScryfallCard | null, e?: React.MouseEvent) => {
    if (card && e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHover({ card, anchor: { right: rect.right, top: rect.top, height: rect.height } });
    } else {
      setHover(null);
    }
  };

  return (
    <div className="mb-2 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Curve</span>
        <span className="text-[11px] text-muted-foreground/60">
          {buckets.countsByCmc.reduce((n, c) => n + c, 0)} non-land · {buckets.landCount} lands
        </span>
      </div>

      {/* CMC column headers */}
      <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 pt-2 text-[10px] text-muted-foreground/70">
        <div></div>
        {COLUMN_LABELS.map((label, i) => (
          <div key={i} className="text-center font-medium tabular-nums">
            {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
          </div>
        ))}
      </div>

      <CurveRow label="Creatures" rowCards={buckets.creatures} onHover={handleHover} />
      <CurveRow label="Non-creatures" rowCards={buckets.noncreatures} onHover={handleHover} />

      <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-1.5 border-t border-border/20 items-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Lands</div>
        <div className="col-span-8 text-[11px] text-muted-foreground/60">{buckets.landCount} lands</div>
      </div>

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
    </div>
  );
}
```

Update `CurveRow` and `CurveCell` to thread the hover handler:

```tsx
interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
}

function CurveRow({ label, rowCards, onHover }: CurveRowProps) {
  return (
    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-2 items-end min-h-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 self-center">{label}</div>
      {rowCards.map((col, i) => (
        <CurveCell key={i} cards={col} onHover={onHover} />
      ))}
    </div>
  );
}

interface CurveCellProps {
  cards: ScryfallCard[];
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
}

function CurveCell({ cards, onHover }: CurveCellProps) {
  if (cards.length === 0) {
    return <div className="min-h-[100px]" />;
  }
  const OVERLAP = 18;
  return (
    <div className="relative" style={{ height: `${(cards.length - 1) * OVERLAP + 90}px` }}>
      {cards.map((card, idx) => {
        const stripeClass = card.deckRole ? (ROLE_STRIPE[card.deckRole] ?? '') : '';
        const imgUrl = getCardImageUrl(card, 'small') ?? '';
        return (
          <div
            key={card.name + idx}
            className="absolute left-0 right-0 transition-transform duration-150 hover:z-50 hover:scale-110"
            style={{ top: `${idx * OVERLAP}px`, zIndex: idx }}
            onMouseEnter={(e) => onHover(card, e)}
            onMouseLeave={() => onHover(null)}
          >
            {stripeClass && <div className={`absolute top-0 left-0 right-0 h-[3px] z-10 ${stripeClass} rounded-t`} />}
            <img
              src={imgUrl}
              alt={card.name}
              className="w-full rounded shadow-md border border-border/40"
              loading="lazy"
              draggable={false}
              title={`${card.name}${card.deckRole ? ` · ${card.deckRole}` : ''}`}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Hover a card in the play area on desktop (≥1024px viewport).
- Card pops forward (scale-110, z-lift).
- A large preview image (~256px wide) appears floating to the right of the column.
- Moving the mouse to another card swaps the preview.
- Moving the mouse off the play area clears the preview.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx
git commit -m "feat(analyze): card hover preview in play area"
```

---

## Task 5: Click to open `CardPreviewModal`

Per the spec, clicking a card opens the existing `CardPreviewModal` (the rich preview with all the bells).

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Add preview state and wire the click**

In `CurvePlayArea.tsx`, add the import:

```tsx
import { CardPreviewModal } from '@/components/ui/CardPreviewModal';
```

Inside the component body, add a preview state alongside `hover`:

```tsx
const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);
```

Thread a click handler down to `CurveCell` the same way as `onHover` — add `onSelect: (card: ScryfallCard) => void` to both `CurveRowProps` and `CurveCellProps`, then in `CurveCell`'s rendered card slot, add:

```tsx
onClick={() => onSelect(card)}
```

…to the outer `<div>` that already has the `onMouseEnter` / `onMouseLeave`.

Pass `onSelect={setPreviewCard}` to both `<CurveRow>` invocations.

At the bottom of the component (just before the closing `</div>` of the root), render the modal:

```tsx
<CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
```

Also change the outer slot from a `<div>` to a `<button>` for accessibility — the slot already has `onClick`; making it a button is one keyword change. Update the className to add `text-left w-full`.

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Click a card in the play area. The full `CardPreviewModal` opens (the same modal that opens elsewhere in the app).
- Close it and click a different card — the modal updates to that card.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx
git commit -m "feat(analyze): click a card in play area to open preview"
```

---

## Task 6: Wire DeckOptimizer to accept `initialSelectedCmc` + broadcast `optimizeView`

Two small additions to `DeckOptimizer`: a controlled-tab-style entry for the Curve tab's CMC selection, and an extra payload field on the state event so `AnalyzePage` can hide the play area in Optimize View.

**Files:**
- Modify: `src/components/deck/optimizer/constants.ts`
- Modify: `src/components/deck/optimizer/DeckOptimizer.tsx`

- [ ] **Step 1: Add `initialSelectedCmc` to `DeckOptimizerProps`**

In `src/components/deck/optimizer/constants.ts`, find the `DeckOptimizerProps` interface and add the new optional prop at the bottom:

```ts
export interface DeckOptimizerProps {
  commanderName: string;
  // ... existing fields ...
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  /** Optional initial value for the Curve tab's CMC focus. */
  initialSelectedCmc?: number | null;
}
```

- [ ] **Step 2: Consume `initialSelectedCmc` and broadcast `optimizeView`**

In `src/components/deck/optimizer/DeckOptimizer.tsx`, locate the destructuring of props (currently `activeTab: controlledActiveTab, onTabChange,`) and add:

```tsx
activeTab: controlledActiveTab,
onTabChange,
initialSelectedCmc,
```

Find the existing `const [selectedCmc, setSelectedCmc] = useState<number | null>(null);` line. Immediately after it, add:

```tsx
// Apply `initialSelectedCmc` whenever the prop changes (e.g. when the user
// clicks a CMC column in the play area). null clears the focus.
useEffect(() => {
  if (initialSelectedCmc !== undefined) {
    setSelectedCmc(initialSelectedCmc);
  }
}, [initialSelectedCmc]);
```

Find the existing `deck-optimizer-state` event dispatch (search for `deck-optimizer-state` in the file). Update the payload to include `optimizeView`:

```tsx
useEffect(() => {
  document.dispatchEvent(new CustomEvent('deck-optimizer-state', {
    detail: { dirty: isAnalysisDirty, loading, hasAnalysis: !!analysis, optimizeView },
  }));
}, [isAnalysisDirty, loading, analysis, optimizeView]);
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: success. No smoke yet — Task 7 wires the consumers.

- [ ] **Step 4: Commit**

```bash
git add src/components/deck/optimizer/constants.ts src/components/deck/optimizer/DeckOptimizer.tsx
git commit -m "feat(analyzer): initialSelectedCmc prop + optimizeView in state event"
```

---

## Task 7: Column-click navigates to Curve tab with CMC focus

Now use the new `DeckOptimizer` hooks: clicking a CMC column in the play area sets a CMC focus that the analyzer picks up.

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Add column-click handler to the play area**

In `src/components/analyze/CurvePlayArea.tsx`, extend the props:

```tsx
interface CurvePlayAreaProps {
  currentCards: ScryfallCard[];
  excludeNames?: Set<string>;
  onCmcSelect?: (cmc: number) => void;
}
```

In the component body, accept `onCmcSelect`. Update the CMC header row so each header is a clickable button:

Replace:

```tsx
{COLUMN_LABELS.map((label, i) => (
  <div key={i} className="text-center font-medium tabular-nums">
    {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
  </div>
))}
```

with:

```tsx
{COLUMN_LABELS.map((label, i) => (
  <button
    key={i}
    type="button"
    onClick={() => onCmcSelect?.(i)}
    className="text-center font-medium tabular-nums py-1 rounded hover:bg-primary/10 hover:text-primary transition-colors"
    aria-label={`Filter analyzer to CMC ${label}`}
  >
    {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
  </button>
))}
```

Also, clicking inside an empty cell should also trigger CMC-select. Extend `CurveRowProps` to accept `onCmcSelect?: (cmc: number) => void` and pass it from the play area:

```tsx
interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
  onSelect: (card: ScryfallCard) => void;
  onCmcSelect?: (cmc: number) => void;
}
```

Inside `CurveRow`, wrap each `CurveCell` with the closure:

```tsx
{rowCards.map((col, i) => (
  <CurveCell
    key={i}
    cards={col}
    onHover={onHover}
    onSelect={onSelect}
    onEmptyClick={() => onCmcSelect?.(i)}
  />
))}
```

Update both `<CurveRow>` invocations in the play area to pass `onCmcSelect={onCmcSelect}`.

In `CurveCell`, when `cards.length === 0`, render the empty slot as a button:

```tsx
if (cards.length === 0) {
  return (
    <button
      type="button"
      onClick={onEmptyClick}
      className="min-h-[100px] w-full rounded hover:bg-primary/5 transition-colors"
      aria-label="Empty CMC column — click to filter"
    />
  );
}
```

(Update `CurveCellProps` to include `onEmptyClick?: () => void`.)

- [ ] **Step 2: Wire `onCmcSelect` in `AnalyzePage`**

In `src/pages/AnalyzePage.tsx`, add a state for the desired CMC and a handler:

Near the other state hooks, add:

```tsx
const [analyzerInitialCmc, setAnalyzerInitialCmc] = useState<number | null>(null);
```

In the `deckLoaded` branch, replace the existing `<CurvePlayArea ... />` mount with:

```tsx
<CurvePlayArea
  currentCards={Object.values(generatedDeck.categories).flat()}
  excludeNames={(() => {
    const s = new Set<string>();
    if (generatedDeck.commander) s.add(generatedDeck.commander.name);
    if (generatedDeck.partnerCommander) s.add(generatedDeck.partnerCommander.name);
    return s;
  })()}
  onCmcSelect={(cmc) => {
    setAnalyzerInitialCmc(cmc);
    handleAnalyzerTabChange('curve');
  }}
/>
```

And on the `<DeckOptimizer>` mount, pass the prop:

```tsx
<DeckOptimizer
  ...
  activeTab={activeAnalyzerTab}
  onTabChange={handleAnalyzerTabChange}
  initialSelectedCmc={analyzerInitialCmc}
/>
```

- [ ] **Step 3: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Load a deck on `/analyze/overview`.
- Click the `3` column header in the play area.
- URL changes to `/analyze/.../tempo` (or `/analyze/tempo` for paste/generated).
- The Curve tab is active and its CMC 3 panel is highlighted/expanded (the existing `selectedCmc` UI lights up).
- Click `5` — same flow, focus moves to CMC 5.
- Click an empty cell in a column — same focus behavior.

- [ ] **Step 4: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): click a CMC column to jump to the Curve tab"
```

---

## Task 8: Top-level collapse toggle (persisted)

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Add collapse state + toggle button**

In `src/components/analyze/CurvePlayArea.tsx`, add imports:

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
```

Add state at the top of the component:

```tsx
const COLLAPSED_KEY = 'analyze-play-area-collapsed';

const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSED_KEY) === 'true');

const toggleCollapsed = () => {
  setCollapsed(prev => {
    const next = !prev;
    localStorage.setItem(COLLAPSED_KEY, String(next));
    return next;
  });
};
```

Update the header to include a toggle button on the right:

```tsx
<div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Curve</span>
  <div className="flex items-center gap-3">
    <span className="text-[11px] text-muted-foreground/60">
      {buckets.countsByCmc.reduce((n, c) => n + c, 0)} non-land · {buckets.landCount} lands
    </span>
    <button
      type="button"
      onClick={toggleCollapsed}
      className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 transition-colors"
      aria-label={collapsed ? 'Expand play area' : 'Collapse play area'}
      aria-expanded={!collapsed}
    >
      {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  </div>
</div>
```

Wrap the body (everything BELOW the header and ABOVE the floating preview) in a conditional. Replace the section starting with `<div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 pt-2 ...`>` and ending after the lands summary div with:

```tsx
{collapsed ? (
  <div className="px-3 py-2 grid grid-cols-8 gap-1 items-end h-12">
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
  <>
    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 pt-2 text-[10px] text-muted-foreground/70">
      <div></div>
      {COLUMN_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onCmcSelect?.(i)}
          className="text-center font-medium tabular-nums py-1 rounded hover:bg-primary/10 hover:text-primary transition-colors"
          aria-label={`Filter analyzer to CMC ${label}`}
        >
          {label} <span className="text-muted-foreground/40">({buckets.countsByCmc[i]})</span>
        </button>
      ))}
    </div>

    <CurveRow label="Creatures" rowCards={buckets.creatures} onHover={handleHover} onSelect={setPreviewCard} onCmcSelect={onCmcSelect} />
    <CurveRow label="Non-creatures" rowCards={buckets.noncreatures} onHover={handleHover} onSelect={setPreviewCard} onCmcSelect={onCmcSelect} />

    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-1.5 border-t border-border/20 items-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Lands</div>
      <div className="col-span-8 text-[11px] text-muted-foreground/60">{buckets.landCount} lands</div>
    </div>
  </>
)}
```

Update the `CurveRow` props interface to accept `onCmcSelect: (cmc: number) => void` and thread it down to `CurveCell` (renaming the existing `onEmptyClick` to `(e) => onCmcSelect?.(columnIndex)`). The simplest version: have `CurveRow` pass the column index by closure when constructing the cells:

```tsx
interface CurveRowProps {
  label: string;
  rowCards: ScryfallCard[][];
  onHover: (card: ScryfallCard | null, e?: React.MouseEvent) => void;
  onSelect: (card: ScryfallCard) => void;
  onCmcSelect?: (cmc: number) => void;
}

function CurveRow({ label, rowCards, onHover, onSelect, onCmcSelect }: CurveRowProps) {
  return (
    <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-2 items-end min-h-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 self-center">{label}</div>
      {rowCards.map((col, i) => (
        <CurveCell
          key={i}
          cards={col}
          onHover={onHover}
          onSelect={onSelect}
          onEmptyClick={() => onCmcSelect?.(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- The chevron at the top-right of the play area toggles between expanded (cards) and collapsed (mini histogram bars + count labels).
- Reloading the page preserves the toggle state.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx
git commit -m "feat(analyze): collapse toggle with persistence + mini histogram"
```

---

## Task 9: Lands row expand/collapse (persisted)

**Files:**
- Modify: `src/components/analyze/CurvePlayArea.tsx`

- [ ] **Step 1: Add lands-expand state + toggle**

In `src/components/analyze/CurvePlayArea.tsx`, add another constant + state next to the existing collapsed state:

```tsx
const LANDS_KEY = 'analyze-play-area-lands-expanded';

const [landsExpanded, setLandsExpanded] = useState<boolean>(() => localStorage.getItem(LANDS_KEY) === 'true');

const toggleLands = () => {
  setLandsExpanded(prev => {
    const next = !prev;
    localStorage.setItem(LANDS_KEY, String(next));
    return next;
  });
};
```

Replace the lands summary block (the `<div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-1.5 border-t border-border/20 items-center">...</div>` near the bottom of the not-collapsed branch) with:

```tsx
<div className="border-t border-border/20">
  <button
    type="button"
    onClick={toggleLands}
    className="w-full grid grid-cols-[80px_repeat(8,1fr)] gap-1 px-2 py-1.5 items-center hover:bg-accent/20 transition-colors text-left"
    aria-expanded={landsExpanded}
  >
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
      {landsExpanded
        ? <ChevronDown className="w-3 h-3" />
        : <ChevronRight className="w-3 h-3" />}
      Lands
    </div>
    <div className="col-span-8 text-[11px] text-muted-foreground/60">
      {buckets.landCount} lands{landsExpanded ? '' : ' · click to expand'}
    </div>
  </button>
  {landsExpanded && (
    <CurveRow label="" rowCards={buckets.lands} onHover={handleHover} onSelect={setPreviewCard} onCmcSelect={onCmcSelect} />
  )}
</div>
```

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Lands row defaults to collapsed (one-line summary).
- Click it — lands cards fan out below in the column-0 cell. Reloading the page preserves the lands-expanded state.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyze/CurvePlayArea.tsx
git commit -m "feat(analyze): expandable lands row"
```

---

## Task 10: Hide the play area during Optimize View

**Files:**
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Listen for analyzer state and gate the play area**

In `src/pages/AnalyzePage.tsx`, near the other state hooks (above the `deckLoaded` derivation), add:

```tsx
const [optimizeViewActive, setOptimizeViewActive] = useState(false);
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ optimizeView?: boolean }>).detail;
    if (detail) setOptimizeViewActive(!!detail.optimizeView);
  };
  document.addEventListener('deck-optimizer-state', handler);
  return () => document.removeEventListener('deck-optimizer-state', handler);
}, []);
```

In the deck-loaded render branch, wrap the `<CurvePlayArea>` mount in a conditional:

```tsx
{!optimizeViewActive && (
  <CurvePlayArea
    currentCards={Object.values(generatedDeck.categories).flat()}
    excludeNames={...}
    onCmcSelect={...}
  />
)}
```

- [ ] **Step 2: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Load a deck on `/analyze`. Play area visible.
- Click "Optimize Deck" (or whatever trigger opens the OptimizeView inside the analyzer — typically via "See more" on the deck grade badge).
- Play area hides while OptimizeView is open.
- Exit OptimizeView (back arrow). Play area returns.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): hide play area during analyzer's Optimize View"
```

---

## Task 11: Patch notes + version bump

**Files:**
- Modify: `src/data/patchNotes.json`
- Modify: `package.json`

- [ ] **Step 1: Bump version**

In `package.json`, change:

```json
"version": "1.3.0"
```

to:

```json
"version": "1.3.1"
```

- [ ] **Step 2: Add patch notes**

In `src/data/patchNotes.json`, prepend a new entry at the start of the array:

```json
{
  "version": "1.3.1",
  "notes": [
    "New curve play area on the Analyze page — see your deck laid out by CMC and type with role-colored stripes.",
    "Click a CMC column in the play area to jump to the Tempo tab focused on that mana value.",
    "Collapse the play area or expand the lands row anytime — your preference is remembered."
  ]
}
```

(Per project memory rule on patch notes: do not remove older entries.)

- [ ] **Step 3: Build+smoke**

```bash
npm run build
npm run dev
```

Smoke:
- Header shows `v1.3.1`.
- Opening the version popover shows the new entry at the top.

- [ ] **Step 4: Commit**

```bash
git add package.json src/data/patchNotes.json
git commit -m "chore: bump to 1.3.1 with curve play area notes"
```

---

## Final acceptance walkthrough

After all 11 tasks, run an end-to-end pass:

1. **Empty `/analyze`** — no play area (only renders in deck-loaded state).
2. **Paste a deck** → loaded view: play area renders above the analyzer with creatures and non-creatures rows, role-colored stripes on each card.
3. **Hover a card** → it pops forward, a large floating preview appears next to the column on desktop.
4. **Click a card** → `CardPreviewModal` opens.
5. **Click a CMC column header** (e.g. `3`) → URL → `/analyze/.../tempo`, Curve tab active with CMC 3 highlighted.
6. **Click an empty cell** → same behavior as clicking the column header.
7. **Expand the lands row** → land cards fan out below.
8. **Collapse the play area** → top-level chevron toggles into a mini histogram strip.
9. **Reload the page** → both collapse states persist.
10. **Enter Optimize View** from the analyzer → play area hides. Exit → it returns.
11. **Mobile viewport** (≤640px) → play area still renders; floating hover preview is suppressed (`hidden lg:block` guard).
12. **Patch notes** — version `1.3.1` shows; new entry on top.

---

## Self-Review Notes

**Spec coverage check** — every spec section maps to a task:

| Spec section | Task(s) |
|---|---|
| Placement & visibility (mount, deck-loaded gate, collapse persistence) | 2, 8, 10 |
| Layout (3 rows × 8 CMC columns, headers, sizes) | 2, 3 |
| Card rendering (fanned, alphabetical, hover pop, hover preview, click preview) | 3, 4, 5 |
| Role color stripe | 3 |
| Interactions (card click → preview; column click → Curve+CMC; row labels no-op; lands expand) | 5, 7, 9 |
| Data flow (`buildCurveBuckets`, role lookup via `card.deckRole`) | 1, 3 |
| Hide during Optimize View | 6 (event payload), 10 (consumer) |
| Files affected (per spec) | matches Task file lists |
| Patch notes / version | 11 |

**Type consistency:** `CurveBuckets`, `CurvePlayAreaProps`, `CurveRowProps`, `CurveCellProps`, `HoverState` defined once each and reused. `onCmcSelect: (cmc: number) => void` signature is consistent across the play area's prop chain. `initialSelectedCmc?: number | null` matches the analyzer's existing `selectedCmc: number | null` state.

**Notes on spec deviations:**

- The spec's hover-preview-after-400ms is implemented as immediate hover-preview (no debounce). The existing `ListDeckView` floating preview uses the same immediate pattern. Adding the 400ms debounce is a small follow-up if it feels too eager in practice.
- The spec mentioned `CardContextMenu` on right-click. The plan uses `CardPreviewModal` on click instead. The context menu (cut / move / ban) is reachable from inside `CardPreviewModal`, so the action surface isn't lost. Adding a dedicated right-click context menu in the play area is a follow-up if needed — kept out of scope here to ship the visual MVP cleanly.
