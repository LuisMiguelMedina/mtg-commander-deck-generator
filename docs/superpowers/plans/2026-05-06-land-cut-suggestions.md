# Land Cut Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a deck has more lands than its target, surface a guaranteed N concrete land-cut suggestions in the Lands tab — including excess basics down to a basic-fetcher-aware floor — with a "Cut all" affordance.

**Architecture:** Pure selection helper (`selectLandCuts`) handles ranking and basic floor logic, isolated from React. The Lands tab calls it and renders the top-N highlighted box + "Cut all" + Other Candidates section using the existing `CutCardGrid` component. No changes to scoring engines (`scoreRecommendation`, `inDeckScoreMap`).

**Tech Stack:** TypeScript, React 18, Vite. No test framework in repo — verification is manual via dev server using rigorous scenarios at the end of the plan.

**Spec:** `docs/superpowers/specs/2026-05-06-land-cut-suggestions-design.md`

---

## File Structure

**Create:**
- `src/services/deckBuilder/landCutSelection.ts` — pure `selectLandCuts` function + basic-fetcher detection.

**Modify:**
- `src/components/deck/optimizer/LandsTab.tsx` — replace the current `cutCandidates` `useMemo` (lines ~308-322) with a call to `selectLandCuts`; render top-N highlighted box, "Cut all" button, basic cut entries, and deck-size-after-cut hint.

**Untouched (deliberate):**
- `src/services/deckBuilder/deckAnalyzer.ts` — scores already on `AnalyzedCard.score`. No changes.
- `src/components/deck/optimizer/OverviewTab.tsx` — Quick Cuts panel is unrelated.

---

## Task 1: Create `landCutSelection.ts` skeleton with types

**Files:**
- Create: `src/services/deckBuilder/landCutSelection.ts`

- [ ] **Step 1: Create the file with types and a stub function**

```typescript
// src/services/deckBuilder/landCutSelection.ts
import type { ScryfallCard } from '@/types';
import type { AnalyzedCard, ColorFixingAnalysis } from './deckAnalyzer';
import { getFrontFaceTypeLine, isMdfcLand, isChannelLand } from '@/services/scryfall/client';
import { isUtilityLand } from '@/services/tagger/client';

export type LandCutKind = 'basic' | 'nonbasic' | 'fallback';

export interface LandCut {
  ac: AnalyzedCard;
  kind: LandCutKind;
  /** For basics: the count this cut takes you from. e.g. 8 (cutting brings to 7). */
  beforeCount?: number;
  afterCount?: number;
  /** Set on `fallback` rows so the UI can render a warning badge. */
  warning?: string;
}

export interface SelectLandCutsInput {
  landCards: AnalyzedCard[];          // analysis.landCards (all lands, basics + nonbasics)
  nonLandCards: ScryfallCard[];       // current non-land cards in deck (for basic-fetcher scan)
  colorFixing: ColorFixingAnalysis;   // for pipDemand
  colorIdentity: string[];            // ['W','U','B','R','G'] subset
  target: number;                     // effective land target (userLandTarget ?? mb.adjustedSuggestion)
  currentLands: number;               // analysis.manaBase.currentLands
  mustIncludeNames: Set<string>;
}

export interface SelectLandCutsResult {
  topN: LandCut[];                    // exactly min(N, available) entries; the cuts to make
  others: LandCut[];                  // additional candidates the user can substitute in
  basicFloor: number;                 // computed floor below which we won't cut basics
  basicFetcherCount: number;          // detected basic-fetcher count
}

export function selectLandCuts(input: SelectLandCutsInput): SelectLandCutsResult {
  // Stub — implemented in subsequent tasks.
  return { topN: [], others: [], basicFloor: 0, basicFetcherCount: 0 };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: No errors. The new file imports cleanly; stub function has correct return shape.

- [ ] **Step 3: Commit**

```bash
git add src/services/deckBuilder/landCutSelection.ts
git commit -m "feat(optimizer): scaffold landCutSelection types and stub"
```

---

## Task 2: Implement basic-fetcher detection

**Files:**
- Modify: `src/services/deckBuilder/landCutSelection.ts`

- [ ] **Step 1: Add `countBasicFetchers` helper and floor formula**

Insert above `selectLandCuts`:

```typescript
const BASIC_FETCH_RE = /search(?:es)?\s+(?:your|their)\s+library\s+for\s+(?:up\s+to\s+\w+\s+)?(?:a\s+)?basic\s+(?:land|forest|island|swamp|mountain|plains)/i;

/** Count cards whose oracle text searches the library for a basic land. */
export function countBasicFetchers(cards: ScryfallCard[]): number {
  let n = 0;
  for (const c of cards) {
    const oracle = c.oracle_text || c.card_faces?.[0]?.oracle_text || '';
    if (BASIC_FETCH_RE.test(oracle)) n++;
  }
  return n;
}

/** Minimum basics to keep so basic-fetchers (Cultivate etc.) have live targets. */
export function computeBasicFloor(basicFetcherCount: number): number {
  return Math.max(2, basicFetcherCount * 2);
}
```

- [ ] **Step 2: Verify regex matches representative cards**

This is a sanity-only check (no test runner). Add a temporary console.log block at the end of the file:

```typescript
// Temporary verification — remove after eyeballing dev console
if (typeof window !== 'undefined' && (window as any).__VERIFY_BASIC_FETCHERS__) {
  const samples = [
    { name: 'Cultivate', text: 'Search your library for up to two basic land cards, reveal those cards, and put one onto the battlefield tapped and the other into your hand. Then shuffle.' },
    { name: 'Farseek', text: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.' },
    { name: 'Path to Exile', text: 'Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.' },
    { name: 'Lightning Bolt', text: 'Lightning Bolt deals 3 damage to any target.' },
  ];
  for (const s of samples) {
    console.log(`[basic-fetch] ${s.name}: ${BASIC_FETCH_RE.test(s.text)}`);
  }
}
```

Run: `npx tsc -b`
Expected: Cultivate=true, Farseek=false (it's not basic-fetch — fetches a *named* land type, not "basic"), Path to Exile=true, Lightning Bolt=false.

After eyeballing, **remove the temporary block** (it ships otherwise).

Note: Farseek detection is intentionally false here. Farseek searches for "Plains, Island, Swamp, or Mountain" — not "basic land". Even though those happen to be basics by type, the regex stays scoped to literal "basic" wording. If this turns out to be a problem in scenarios, a future task can broaden it. For v1 this is a deliberate trade-off favoring precision over recall.

- [ ] **Step 3: Remove the temporary verification block**

Delete the `if (typeof window !== 'undefined' && (window as any).__VERIFY_BASIC_FETCHERS__)` block.

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/deckBuilder/landCutSelection.ts
git commit -m "feat(optimizer): basic-fetcher detection + floor formula"
```

---

## Task 3: Implement basic surplus selection (color-aware)

**Files:**
- Modify: `src/services/deckBuilder/landCutSelection.ts`

- [ ] **Step 1: Add basic categorization and selection helpers**

Insert above `selectLandCuts`:

```typescript
const BASIC_NAMES = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
]);

const BASIC_TO_COLOR: Record<string, string> = {
  'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G',
  'Snow-Covered Plains': 'W', 'Snow-Covered Island': 'U', 'Snow-Covered Swamp': 'B',
  'Snow-Covered Mountain': 'R', 'Snow-Covered Forest': 'G',
  'Wastes': 'C',
};

interface BasicGroup {
  name: string;       // 'Forest', 'Snow-Covered Forest', 'Wastes', etc.
  color: string;      // 'W'|'U'|'B'|'R'|'G'|'C'
  count: number;
  /** A representative AnalyzedCard from this group (used for rendering). */
  sample: AnalyzedCard;
}

/** Group basics by name with counts, in stable name order. */
function groupBasics(landCards: AnalyzedCard[]): BasicGroup[] {
  const map = new Map<string, BasicGroup>();
  for (const ac of landCards) {
    if (!BASIC_NAMES.has(ac.card.name)) continue;
    const existing = map.get(ac.card.name);
    if (existing) {
      existing.count++;
    } else {
      map.set(ac.card.name, {
        name: ac.card.name,
        color: BASIC_TO_COLOR[ac.card.name] || 'C',
        count: 1,
        sample: ac,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Select up to `wantCuts` basic-cut LandCut entries, never dropping total basics
 * below `basicFloor`. Picks from most-oversupplied color first; ties broken by larger
 * group then alphabetical name.
 *
 * Oversupply per color = currentBasicsForColor - expectedBasicsForColor,
 * where expected is proportional to pip-demand share. If pipDemandTotal is 0 (no
 * colored spells), distribute expected evenly across colors present in basics.
 */
function selectBasicCuts(
  basics: BasicGroup[],
  totalBasics: number,
  basicFloor: number,
  pipDemand: Record<string, number>,
  pipDemandTotal: number,
  wantCuts: number,
): LandCut[] {
  const cuts: LandCut[] = [];
  if (wantCuts <= 0 || totalBasics <= basicFloor) return cuts;

  // Working copy of counts so we can decrement as we cut.
  const counts = new Map<string, number>();
  for (const g of basics) counts.set(g.name, g.count);

  const colorsPresent = [...new Set(basics.map(g => g.color))];

  const computeOversupply = (): { name: string; over: number; count: number }[] => {
    const totalNow = [...counts.values()].reduce((s, n) => s + n, 0);
    return basics
      .filter(g => (counts.get(g.name) ?? 0) > 0)
      .map(g => {
        const cur = counts.get(g.name) ?? 0;
        // Sum of all basics currently of this group's color.
        const colorTotal = basics
          .filter(other => other.color === g.color)
          .reduce((s, other) => s + (counts.get(other.name) ?? 0), 0);
        // Expected share: pip-demand for this color / pipDemandTotal × totalNow.
        // If pipDemandTotal is 0, evenly distribute among colorsPresent.
        const expectedColor = pipDemandTotal > 0
          ? (pipDemand[g.color] || 0) / pipDemandTotal * totalNow
          : totalNow / Math.max(1, colorsPresent.length);
        const over = colorTotal - expectedColor;
        return { name: g.name, over, count: cur };
      });
  };

  let totalNow = totalBasics;
  const remainingToCut = () => Math.min(wantCuts - cuts.length, totalNow - basicFloor);

  while (remainingToCut() > 0) {
    const ranked = computeOversupply()
      .sort((a, b) => {
        if (b.over !== a.over) return b.over - a.over;
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    if (ranked.length === 0) break;
    const pick = ranked[0];
    const group = basics.find(g => g.name === pick.name)!;
    const before = counts.get(pick.name) ?? 0;
    const after = before - 1;
    counts.set(pick.name, after);
    totalNow--;
    cuts.push({
      ac: group.sample,
      kind: 'basic',
      beforeCount: before,
      afterCount: after,
    });
  }

  return cuts;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/deckBuilder/landCutSelection.ts
git commit -m "feat(optimizer): basic surplus selection with pip-demand awareness"
```

---

## Task 4: Implement nonbasic and fallback selection

**Files:**
- Modify: `src/services/deckBuilder/landCutSelection.ts`

- [ ] **Step 1: Add nonbasic/fallback helpers**

Insert above `selectLandCuts`:

```typescript
/** True if a land is a strict cuttable nonbasic — excludes basics, MDFC, channel, utility. */
function isPureNonbasic(ac: AnalyzedCard): boolean {
  if (BASIC_NAMES.has(ac.card.name)) return false;
  if (isMdfcLand(ac.card)) return false;
  if (isChannelLand(ac.card)) return false;
  if (isUtilityLand(ac.card.name)) return false;
  const tl = getFrontFaceTypeLine(ac.card).toLowerCase();
  return tl.includes('land');
}

/** True if a land is an MDFC or utility (allowed only as last-resort). */
function isFallbackEligible(ac: AnalyzedCard): boolean {
  // Channel lands stay excluded — too high cost to cut.
  if (isChannelLand(ac.card)) return false;
  if (BASIC_NAMES.has(ac.card.name)) return false;
  return isMdfcLand(ac.card) || isUtilityLand(ac.card.name);
}

/** Sort by AnalyzedCard.score ascending (lowest = weakest = most cuttable). */
function byScoreAsc(a: AnalyzedCard, b: AnalyzedCard): number {
  return (a.score ?? 0) - (b.score ?? 0);
}

function selectNonbasicCuts(
  landCards: AnalyzedCard[],
  mustIncludeNames: Set<string>,
  wantCuts: number,
  takenNames: Set<string>,
): LandCut[] {
  if (wantCuts <= 0) return [];
  return landCards
    .filter(ac => isPureNonbasic(ac))
    .filter(ac => !mustIncludeNames.has(ac.card.name))
    .filter(ac => !takenNames.has(ac.card.name))
    .sort(byScoreAsc)
    .slice(0, wantCuts)
    .map(ac => ({ ac, kind: 'nonbasic' as const }));
}

function selectFallbackCuts(
  landCards: AnalyzedCard[],
  mustIncludeNames: Set<string>,
  wantCuts: number,
  takenNames: Set<string>,
): LandCut[] {
  if (wantCuts <= 0) return [];
  return landCards
    .filter(ac => isFallbackEligible(ac))
    .filter(ac => !mustIncludeNames.has(ac.card.name))
    .filter(ac => !takenNames.has(ac.card.name))
    .sort(byScoreAsc)
    .slice(0, wantCuts)
    .map(ac => ({
      ac,
      kind: 'fallback' as const,
      warning: isMdfcLand(ac.card) ? 'Loses spell flexibility' : 'Loses utility',
    }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/deckBuilder/landCutSelection.ts
git commit -m "feat(optimizer): nonbasic + fallback land cut helpers"
```

---

## Task 5: Wire `selectLandCuts` together

**Files:**
- Modify: `src/services/deckBuilder/landCutSelection.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

Replace the current stub `selectLandCuts` body with:

```typescript
export function selectLandCuts(input: SelectLandCutsInput): SelectLandCutsResult {
  const {
    landCards, nonLandCards, colorFixing, colorIdentity, target, currentLands, mustIncludeNames,
  } = input;

  const N = Math.max(0, currentLands - target);
  const basicFetcherCount = countBasicFetchers(nonLandCards);
  const basicFloor = computeBasicFloor(basicFetcherCount);

  if (N === 0) {
    return { topN: [], others: [], basicFloor, basicFetcherCount };
  }

  // 1. Surplus basics down to floor.
  const basics = groupBasics(landCards);
  const totalBasics = basics.reduce((s, g) => s + g.count, 0);
  const basicCuts = selectBasicCuts(
    basics, totalBasics, basicFloor,
    colorFixing.pipDemand, colorFixing.pipDemandTotal,
    N,
  );

  const taken = new Set<string>();
  // Basic cuts can repeat the same name across copies; only mark as taken when
  // we move to nonbasics so they aren't re-selected. Basics use copy-counts, nonbasics use names.
  // (No name added to `taken` for basics — they're identified by copies.)

  // 2. Weakest nonbasics.
  const stillWanted = N - basicCuts.length;
  const nonbasicCuts = selectNonbasicCuts(landCards, mustIncludeNames, stillWanted, taken);
  for (const c of nonbasicCuts) taken.add(c.ac.card.name);

  // 3. Last-resort fallback (MDFC/utility) only if priorities 1+2 short of N.
  const fallbackWanted = N - basicCuts.length - nonbasicCuts.length;
  const fallbackCuts = selectFallbackCuts(landCards, mustIncludeNames, fallbackWanted, taken);
  for (const c of fallbackCuts) taken.add(c.ac.card.name);

  const topN = [...basicCuts, ...nonbasicCuts, ...fallbackCuts].slice(0, N);

  // 4. "Other candidates" — surface up to 6 more weakest-nonbasic candidates not already in topN.
  const OTHERS_LIMIT = 6;
  const othersTaken = new Set(taken);
  const others: LandCut[] = landCards
    .filter(ac => isPureNonbasic(ac))
    .filter(ac => !mustIncludeNames.has(ac.card.name))
    .filter(ac => !othersTaken.has(ac.card.name))
    .sort(byScoreAsc)
    .slice(0, OTHERS_LIMIT)
    .map(ac => ({ ac, kind: 'nonbasic' as const }));

  return { topN, others, basicFloor, basicFetcherCount };
}
```

Note on `colorIdentity`: it's accepted in the input for potential future per-color floors but is unused in v1. Keep the field — removing it would be a breaking signature change later.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/deckBuilder/landCutSelection.ts
git commit -m "feat(optimizer): selectLandCuts wires basic/nonbasic/fallback paths"
```

---

## Task 6: Integrate into LandsTab — replace existing cut logic

**Files:**
- Modify: `src/components/deck/optimizer/LandsTab.tsx`

- [ ] **Step 1: Read the current `cutCandidates` block to understand surroundings**

Read [LandsTab.tsx:308-322](src/components/deck/optimizer/LandsTab.tsx#L308-L322). The component holding it is `LandCountDetail` (declared at [LandsTab.tsx:256](src/components/deck/optimizer/LandsTab.tsx#L256)). The block currently filters `nonbasicLands.filter(ac => !isChannelLand(ac.card))`, sorts, and slices. We replace this with a call to `selectLandCuts`.

`LandCountDetail` does not currently receive `currentCards` — it only takes `analysis`. We add `currentCards: ScryfallCard[]` to its prop signature and pass it from the call site at [LandsTab.tsx:1681](src/components/deck/optimizer/LandsTab.tsx#L1681) (where `currentCards` is already in scope on `LandsTabContent`).

- [ ] **Step 2: Add `currentCards` prop to `LandCountDetail`**

Update the `LandCountDetail` props interface at [LandsTab.tsx:256-269](src/components/deck/optimizer/LandsTab.tsx#L256-L269):

```typescript
export function LandCountDetail({
  analysis, currentCards, onPreview, onAdd, addedCards, onCardAction, menuProps, colorIdentity, onAddBasicLand, onRemoveBasicLand, cardInclusionMap,
}: {
  analysis: DeckAnalysis;
  currentCards: ScryfallCard[];
  // ...rest unchanged
}) {
```

Update the call site at line 1681 to pass `currentCards={currentCards}`.

- [ ] **Step 3: Replace `cutCandidates` with a call to `selectLandCuts`**

Inside `LandCountDetail`, replace the existing `useMemo` block (around lines 308-322) with:

```typescript
import { selectLandCuts, type LandCut } from '@/services/deckBuilder/landCutSelection';

// ...inside the component...

// Non-land cards in the current deck (for basic-fetcher scan).
const nonLandCardsInDeck = useMemo(
  () => currentCards.filter(c => !getFrontFaceTypeLine(c).toLowerCase().includes('land') && !isMdfcLand(c)),
  [currentCards],
);

const effectiveTarget = mb.adjustedSuggestion;

const cutSelection = useMemo(() => selectLandCuts({
  landCards: analysis.landCards,
  nonLandCards: nonLandCardsInDeck,
  colorFixing: analysis.colorFixing,
  colorIdentity,
  target: effectiveTarget,
  currentLands: mb.currentLands,
  mustIncludeNames: menuProps?.mustIncludeNames ?? new Set(),
}), [analysis.landCards, nonLandCardsInDeck, analysis.colorFixing, colorIdentity,
     effectiveTarget, mb.currentLands, menuProps?.mustIncludeNames]);

const cutCandidates: AnalyzedCard[] = useMemo(
  () => [...cutSelection.topN, ...cutSelection.others].map(c => c.ac),
  [cutSelection],
);
```

Notes:
- `mb.adjustedSuggestion` already reflects the user's land-target override (post `analyzeDeck` recompute).
- The `cutCandidates: AnalyzedCard[]` shape is preserved as a transitional step — Task 7 replaces its single render site, so `cutCandidates` itself becomes dead code in Task 7. (We keep it in Task 6 only so this task compiles standalone.)

- [ ] **Step 4: Verify the file still compiles**

Run: `npx tsc -b && npm run lint`
Expected: No errors. There may be unused imports (`edhrecRankToInclusion`, sort variables that the old `cutCandidates` used) — leave them only if still used elsewhere, otherwise remove.

- [ ] **Step 5: Commit**

```bash
git add src/components/deck/optimizer/LandsTab.tsx
git commit -m "refactor(optimizer): LandsTab uses selectLandCuts helper"
```

---

## Task 7: LandsTab — render top-N highlighted box with "Cut all"

**Files:**
- Modify: `src/components/deck/optimizer/LandsTab.tsx`

- [ ] **Step 1: Add a helper to remove a `LandCut` (handles basic vs nonbasic routing)**

Inside the component body, after `cutSelection` is computed:

```typescript
const handleRemoveLandCut = useCallback((cut: LandCut) => {
  if (cut.kind === 'basic') {
    onRemoveBasicLand?.(cut.ac.card.name);
  } else {
    // nonbasic + fallback both go through onCardAction remove
    onCardAction?.(cut.ac.card, { type: 'remove' });
    setRemovedCards(prev => new Set([...prev, cut.ac.card.name]));
  }
}, [onRemoveBasicLand, onCardAction]);

const handleCutAllTopN = useCallback(() => {
  for (const cut of cutSelection.topN) {
    handleRemoveLandCut(cut);
  }
}, [cutSelection.topN, handleRemoveLandCut]);
```

- [ ] **Step 2: Render the top-N highlighted box**

Find where the existing `CutCardGrid` is rendered (around line 553). Replace it with two grids — top-N in a red-tinted container with the "Cut all" header, and "Other candidates" below.

Compute the post-cut total once for the hint:

```typescript
const totalCardsAfterCuts = (props.currentCards?.length ?? mb.deckSize) - cutSelection.topN.length;
```

Replace the single `<CutCardGrid ... />` with:

```tsx
{cutSelection.topN.length > 0 && (
  <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-2 mb-3">
    <div className="flex items-center justify-between mb-1.5 px-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80">
        Cut these {cutSelection.topN.length} to hit {effectiveTarget} lands
      </p>
      <button
        onClick={handleCutAllTopN}
        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border border-red-500/30 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Scissors className="w-2.5 h-2.5" />
        Cut all
      </button>
    </div>
    <CutCardGrid
      cards={cutSelection.topN.map(c => c.ac)}
      onRemove={(card) => {
        const cut = cutSelection.topN.find(c => c.ac.card.name === card.name);
        if (cut) handleRemoveLandCut(cut);
      }}
      onPreview={onPreview}
      removedCards={removedCards}
      excess={cutSelection.topN.length}
      onCardAction={onCardAction}
      menuProps={menuProps}
      cardInclusionMap={resolvedInclusionMap}
      sortMode={cutSortMode}
    />
    <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-1">
      Deck will be {totalCardsAfterCuts} cards after cuts. Use Suggestions to backfill.
    </p>
  </div>
)}

{cutSelection.others.length > 0 && (
  <>
    <div className="flex items-center gap-2 mb-1.5 px-1">
      <div className="flex-1 h-px bg-border/30" />
      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Other candidates</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
    <CutCardGrid
      cards={cutSelection.others.map(c => c.ac)}
      onRemove={(card) => {
        const cut = cutSelection.others.find(c => c.ac.card.name === card.name);
        if (cut) handleRemoveLandCut(cut);
      }}
      onPreview={onPreview}
      removedCards={removedCards}
      excess={0}
      onCardAction={onCardAction}
      menuProps={menuProps}
      cardInclusionMap={resolvedInclusionMap}
      sortMode={cutSortMode}
    />
  </>
)}

{cutSelection.topN.length === 0 && cutSelection.others.length === 0 && (
  <p className="text-xs text-muted-foreground/70 px-1">No cut candidates available.</p>
)}
```

The trigger condition `currentLands > target` is already handled by `cutSelection.topN.length > 0` — when at-or-below target, `selectLandCuts` returns empty `topN`, so the red box doesn't render.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b && npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/deck/optimizer/LandsTab.tsx
git commit -m "feat(optimizer): top-N land cut box with Cut all button"
```

---

## Task 8: Show basic count delta and fallback warning on rows

**Files:**
- Modify: `src/components/deck/optimizer/LandsTab.tsx`
- Modify: `src/components/deck/optimizer/OverviewTab.tsx` (extend `CutCardItem` props with optional badges)

- [ ] **Step 1: Read `CutCardItem` to find where the card name renders**

Read [OverviewTab.tsx:316-400](src/components/deck/optimizer/OverviewTab.tsx#L316-L400). The component renders an image + name. We add two optional props: `countLabel?: string` (e.g. "8 → 7") and `warning?: string` (e.g. "Loses spell flexibility").

- [ ] **Step 2: Extend `CutCardItem` and `CutCardGrid` to accept optional `badges`**

In `OverviewTab.tsx`, change `CutCardGrid` to accept an optional `getBadges?: (card: AnalyzedCard) => { countLabel?: string; warning?: string }` callback. Inside the grid, pass the result to each `CutCardItem`.

```typescript
// CutCardGrid signature additions:
getBadges?: (ac: AnalyzedCard) => { countLabel?: string; warning?: string } | undefined;

// In CutCardItem signature additions:
countLabel?: string;
warning?: string;
```

In `CutCardItem`, render the `countLabel` (if present) as a small badge near the name:

```tsx
{countLabel && (
  <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-amber-500/15 text-amber-400 ml-1">
    {countLabel}
  </span>
)}
{warning && (
  <span className="text-[9px] text-amber-400/80 mt-0.5 block" title={warning}>
    ⚠ {warning}
  </span>
)}
```

Place these inside the existing card content block, near where price/inclusion render. (Read the existing block to pick the best spot — typically the small footer line under the image.)

- [ ] **Step 3: Pass `getBadges` from LandsTab**

In `LandsTab.tsx`, where the top-N grid is rendered:

```tsx
getBadges={(ac) => {
  const cut = cutSelection.topN.find(c => c.ac.card.name === ac.card.name);
  if (!cut) return undefined;
  return {
    countLabel: cut.kind === 'basic' && cut.beforeCount != null && cut.afterCount != null
      ? `${cut.beforeCount} → ${cut.afterCount}`
      : undefined,
    warning: cut.warning,
  };
}}
```

The "Other candidates" grid does not need badges (only nonbasics live there).

- [ ] **Step 4: Verify it compiles and lint is clean**

Run: `npx tsc -b && npm run lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/deck/optimizer/LandsTab.tsx src/components/deck/optimizer/OverviewTab.tsx
git commit -m "feat(optimizer): basic count delta + fallback warning badges on cut rows"
```

---

## Task 9: Manual verification scenarios

**Files:** none (manual via dev server)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Scenario A — over-target with basic surplus, no fetchers**

Build a deck (any commander) and use the Add Card flow to push it to e.g. 38 lands at 35 target, with 8 Forests and 0 basic-fetchers.

Expected:
- Lands tab → right column shows red "Cut these 3 to hit 35 lands" box.
- Top 3 entries are 3 Forests (or surplus from the most-oversupplied color), each labeled "8 → 7", "7 → 6", "6 → 5".
- "Cut all" button visible. Clicking it removes 3 basics; box disappears once at target.
- Hint reads "Deck will be N cards after cuts."

- [ ] **Step 3: Scenario B — over-target with basic-fetchers**

Same deck as A, but add 4 Cultivate-style cards (Cultivate, Kodama's Reach, Rampant Growth, Three Visits).

Expected:
- `basicFloor = max(2, 4*2) = 8`. With 8 Forests, no basics are cut (already at floor).
- Top 3 entries are nonbasics (weakest by score).

- [ ] **Step 4: Scenario C — over-target with mixed basics + nonbasics surplus**

A deck with 38 lands at 35 target, 12 basics (split colors), 0 fetchers, several weak nonbasics.

Expected:
- Top 3 are basics (basics rank above nonbasics in priority).
- "Other candidates" below shows up to 6 weakest nonbasics.
- Basic color picked aligns with whichever color is most over its pip-demand share (verify by checking colorFixing pipDemand in React DevTools or console).

- [ ] **Step 5: Scenario D — over-target but only utility/MDFC available**

Edge case: deck has 35 land target, 38 lands, but only 0 basics, 0 pure nonbasics in deck — only utility lands and MDFCs. (Construct by adding utility lands.)

Expected:
- Fallback path triggers. Top-N shows utility/MDFC entries with "Loses utility" / "Loses spell flexibility" warnings.

- [ ] **Step 6: Scenario E — at-target (no over)**

Reduce lands to exactly 35.

Expected:
- No red box. No "Cut all". Other candidates may still show (existing behavior — confirm OK or hide).
- If "Other candidates" is showing without a top-N, that's confusing — adjust so the Other section also requires `topN.length > 0`. **If that's the case, edit Task 7 step 2 and ship the fix in this task as a follow-up commit.**

- [ ] **Step 7: Scenario F — must-include protection**

Mark a weak nonbasic as must-include (via context menu).

Expected:
- That card never appears in top-N or others.

- [ ] **Step 8: Type-check + lint final pass**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: All pass. Build succeeds.

- [ ] **Step 9: Commit any UI tweaks from verification**

If any scenario surfaced a UI issue (e.g., Scenario E), commit the fix:

```bash
git add -p src/components/deck/optimizer/LandsTab.tsx
git commit -m "fix(optimizer): hide Other candidates when no top-N cuts"
```

---

## Spec Coverage Check

- ✅ Trigger `currentLands > effectiveLandTarget` — Task 5 / Task 7 step 2
- ✅ N = `currentLands - effectiveLandTarget` — Task 5
- ✅ Surplus basics down to floor with pip-demand-aware color selection — Tasks 2, 3, 5
- ✅ `basicFloor = max(2, basicFetcherCount * 2)` — Task 2
- ✅ Basic-fetcher detection via oracle regex — Task 2
- ✅ Weakest nonbasics via `inDeckScoreMap` (already on `AnalyzedCard.score`) — Task 4
- ✅ Last-resort MDFC/utility fallback with warning — Tasks 4, 8
- ✅ Channel lands always excluded — Task 4
- ✅ Must-includes excluded — Tasks 4, 5
- ✅ Other candidates section (~6 nonbasics) — Task 5
- ✅ Top-N red box + "Cut all" + deck-size hint — Task 7
- ✅ Basic count delta on rows — Task 8
- ✅ Fallback warning badges — Task 8
- ✅ No changes to `scoreRecommendation` or `inDeckScoreMap` — confirmed throughout
- ✅ Pure helper isolated for testability — Tasks 1-5
