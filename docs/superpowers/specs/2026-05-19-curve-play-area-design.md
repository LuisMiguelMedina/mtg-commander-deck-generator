# Curve Play Area — Design Spec

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan

## Summary

A new visual component, `CurvePlayArea`, that renders the current deck as an Arena-style fanned card grid above the analyzer on `/analyze`. Columns are CMC (0…7+); rows are Creatures, Non-creatures, and a collapsible Lands row. Each card slot wears a thin colored stripe matching the analyzer's role palette (ramp/removal/wipe/draw). The play area is read-leaning with one purposeful interaction: clicking a CMC column jumps the analyzer to its Curve tab focused on that CMC.

The component gives the deck a *physical identity* on the page — something the all-text analyzer tabs can't do — without competing with the analyzer for action surface.

## Goals

1. Make the deck's curve and type-distribution legible at a glance.
2. Reuse existing role-color vocabulary (the badges in the recommended-cards lists) so the visual narrative is consistent with the rest of the analyzer.
3. Bridge to the analyzer's existing Curve tab via column-clicks, without duplicating its functionality.
4. Be cheap to ship — pure projection of existing deck state; no new computation, no new card metadata.

## Non-goals

- **No drag-and-drop reordering** of cards between cells. The play area is not a deck editor.
- **No analyzer→play area highlights** (no glows on deficit columns, no flying-card animations on cut, no ghost outlines for recommended-add cards). Interactions flow only one way: play area → analyzer.
- **No multi-role visualisation.** A card has one canonical role (`card.deckRole`) — that's what we stripe with. No overlapping stripes, no role-mixing UI.
- **No sticky/scroll-pinning.** The play area scrolls away with the page.
- **No legend in the play area itself.** The Roles tab and existing badges already teach the color vocabulary.
- **Not mounted outside `/analyze`.** Not on BuilderPage, ListDeckView, etc.

## Placement & visibility

- Mounted in `AnalyzePage.tsx` between the `CommanderStrip` and the `DeckOptimizer`, only in the deck-loaded state (same gate as the analyzer itself).
- Always visible across all five analyzer tabs (Overview / Roles / Mana / Tempo / Bracket). The component does not change content per tab — only the analyzer below it does.
- Hidden when `DeckOptimizer` is in its full-screen Optimize View (`optimizeView === true` inside the analyzer). The existing `deck-optimizer-state` custom event already broadcasts analyzer state to the CommanderStrip; we extend its payload with `optimizeView: boolean` and have `AnalyzePage` (which owns the play area) listen for it and pass a `hidden` boolean down to `CurvePlayArea`.
- A chevron toggle at the top-right collapses it to a one-line height-summary strip (mini histogram bars + total non-land count). Collapse state persists in `localStorage` under `analyze-play-area-collapsed`.
- Lands row collapsed by default; toggles independently and persists in `localStorage` under `analyze-play-area-lands-expanded`.

## Layout

Three rows sharing the same 8-column CMC grid (`0 · 1 · 2 · 3 · 4 · 5 · 6 · 7+`).

```
┌──────────────────────────────────────────────────────────────┐
│ CURVE                                          [▼ collapse]  │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│ CMC: │  0   │  1   │  2   │  3   │  4   │  5   │  6   │ 7+   │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│Creat.│      │ ▓▓   │ ▓▓▓▓ │ ▓▓▓▓ │ ▓▓▓  │ ▓▓   │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│Non-  │ ▓▓   │ ▓▓▓  │ ▓▓▓▓ │ ▓▓▓  │ ▓▓   │      │      │      │
│creat.│      │      │      │      │      │      │      │      │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┤
│ Lands · 37  [▶ expand]                                       │
└──────────────────────────────────────────────────────────────┘
```

### Card rendering inside a cell

- Cards stack with heavy vertical overlap (~80-85% covered). Only the top sliver — title + mana cost band — is visible for cards above the bottom one. The bottom card in the fan is shown in full.
- Cards within a column are sorted **alphabetically** for deterministic, predictable scanning.
- On hover, the hovered card pops forward (`z-index` lift + `scale-105` transform). After a ~400ms hover delay, the existing `CardPreviewModal` hover pattern displays the large card preview next to it. No new preview component.

### Sizing

- Card slot width: **~60px on desktop**, scales down to **~45px on mobile** (≤640px breakpoint).
- Each non-lands row is **~140-160px tall** when populated (taller than one card so the fan has visible room).
- Total play area heights:
  - Expanded, lands collapsed: **~340-380px** (including padding and headers).
  - Expanded, lands expanded: **~500-560px**.
  - Whole component collapsed: **~48px** one-line strip with mini histogram + counts.

### Column hover

Hovering any cell within a CMC column tints the whole column subtly (`bg-primary/5`) so the user can read "I'm scanning column 3."

## Role coloring

Each card slot gets a **thin colored stripe along the top edge** (3px tall, full card-width):

| Role | Stripe color | Source |
|---|---|---|
| Ramp | `bg-emerald-500` | `card.deckRole === 'ramp'` |
| Removal | `bg-rose-500` | `card.deckRole === 'removal'` |
| Boardwipe | `bg-orange-500` | `card.deckRole === 'boardwipe'` |
| Card Draw / Advantage | `bg-sky-500` | `card.deckRole === 'cardDraw'` |
| No role / Other | no stripe | `card.deckRole` is null/undefined |

**Single-role only.** A card may technically tag into multiple roles during deck enrichment, but for the play area stripe we use `card.deckRole` — the canonical primary role already assigned by the role-priority cascade (`boardwipe > removal > ramp > cardDraw`) in `getRoleBadgeProps()` / `stampRoleSubtypes()`. This guarantees the play area never disagrees with the badges the user sees elsewhere.

Stripe is on the **slot frame**, not the card image — it does not fight the card art and matches the visible "title sliver" of fanned cards.

Hover tooltip on each card includes the role name in text ("Ramp · Mana Rock") for users who haven't learned the color vocabulary yet.

## Interactions

One-way wiring: play area → analyzer. Analyzer never reaches back into the play area.

### Card-level

| Gesture | Effect |
|---|---|
| Hover a card | Card pops forward (`z-index` lift + `scale-105`). After ~400ms, `CardPreviewModal` hover preview floats next to the card. |
| Click a card | Opens the existing `CardContextMenu` (from `DeckDisplay`) anchored to the slot — same menu used by the analyzer's recommended-cards grid (Preview · Cut · Move to sideboard · Move to maybeboard · Add to user list · Ban etc). |
| Right-click a card | Same as click. |

### Column-level

| Gesture | Effect |
|---|---|
| Click a CMC column header (the `2`, `3`, etc.) | Navigate to `/analyze/<listId>/tempo` (or `/analyze/tempo` for paste/generated) AND set the Curve tab's `selectedCmc` to the clicked value. |
| Click an empty cell (within a CMC column) | Same as clicking the column header. |

### Row-level

| Gesture | Effect |
|---|---|
| Click the "Creatures" / "Non-creatures" row label | No-op at MVP. Future hook for "filter analyzer to type X." |
| Click "▶ expand" on the Lands row | Toggles the lands sub-grid. Persists in `localStorage`. |

### Drag-and-drop

Out of scope. Cards do not move between columns or rows via drag.

### Cut / Add propagation

When a card is cut from the deck via any path (play-area context menu, analyzer recommended-cards list, Optimize View), the play area re-renders from the same `currentCards` source as the analyzer (`Object.values(generatedDeck.categories).flat()` from the Zustand store). Deletions appear instantly. A simple `transition-opacity` fade-out on slot removal is enough — no bespoke flying-card animation.

## Data flow

### Bucketing

A new pure helper `buildCurveBuckets(cards, opts)` projects a `ScryfallCard[]` into the play area's shape:

```ts
export interface CurveBuckets {
  creatures: ScryfallCard[][];     // length 8 (CMC 0..7+)
  noncreatures: ScryfallCard[][];  // length 8
  lands: ScryfallCard[][];         // length 8 (mostly all in [0])
  countsByCmc: number[];           // length 8 — total non-land cards per CMC
  landCount: number;
}

export interface BuildCurveBucketsOptions {
  excludeNames?: Set<string>;      // e.g. commander, partner
}

export function buildCurveBuckets(
  cards: ScryfallCard[],
  opts?: BuildCurveBucketsOptions,
): CurveBuckets;
```

Bucketing rules:

1. **Exclude commanders.** Cards whose names appear in `opts.excludeNames` are skipped — commanders show in the CommanderStrip, not the play area.
2. **Lands first** — `isAnyLand(card)` (existing helper from `src/services/scryfall/client.ts`) → `lands` row. All lands collapse into column 0 (CMC has no meaningful column position for lands).
3. **Creatures** — front-face type line includes `creature` → `creatures` row.
4. **Everything else** — `noncreatures` row (Instant, Sorcery, Artifact, Enchantment, Planeswalker, Battle).
5. **Column index** — `Math.min(Math.floor(card.cmc), 7)`. Matches the existing pattern in `computeStatsFromCards` (`analyzeHydration.ts` and `ListDeckView.tsx`).
6. Within each cell, cards are returned sorted alphabetically by name.

### Role lookup

The play area reads `card.deckRole` directly. No new role computation. If `deckRole` is absent (e.g., for cards from a paste flow that wasn't enriched yet), the stripe is omitted — graceful no-op.

### State

- `collapsed: boolean` — top-level collapse, persisted to `localStorage`.
- `landsExpanded: boolean` — lands sub-row expand, persisted to `localStorage`.
- `hoveredCard: ScryfallCard | null` — for the pop-forward / preview pattern.

No global state changes from the play area beyond the analyzer-tab navigation it triggers on column-click.

## Files affected

**New:**

- `src/components/analyze/CurvePlayArea.tsx` — the component (single file).
- `src/components/analyze/CurvePlayArea.buckets.ts` — `buildCurveBuckets` pure helper + types.

**Modified:**

- `src/pages/AnalyzePage.tsx` — mount `<CurvePlayArea>` in the deck-loaded state above `<DeckOptimizer>`. Pass `currentCards` + the same `excludeNames` set used for the analyzer. Pass through a callback to navigate to the Curve tab + set `selectedCmc`.
- `src/components/deck/optimizer/DeckOptimizer.tsx` — two small additions:
  - Accept an optional `initialSelectedCmc?: number` prop and apply it once on mount (or when it changes) to the existing `selectedCmc` state inside the Curve tab. Roughly a 3-line addition.
  - Extend the existing `deck-optimizer-state` event payload with `optimizeView: boolean` so AnalyzePage can hide the play area during Optimize View.

**Untouched:**

- `src/components/deck/optimizer/CurveTab.tsx` — its existing `selectedCmc` state handling is reused unchanged.
- `src/services/scryfall/client.ts` — `isAnyLand` already exported.
- `src/services/deckBuilder/deckEnricher.ts` — `deckRole` stamping unchanged.

## Accessibility

- Card slots are `<button>` elements with `aria-label="<card name>, CMC <n>, <role>"`.
- Column headers are `<button>` elements with `aria-label="Filter analyzer to CMC <n>"`.
- Collapse / lands-expand chevrons have `aria-expanded` and matching labels.
- Hover preview is decorative — the existing `CardPreviewModal` is reachable via click.

## Out of scope (future)

- Drag-and-drop reordering / cross-cell moves.
- Analyzer → play area highlights (deficit glow, recommend-add ghost slot, cut animation).
- Sticky/scroll-pinning behavior.
- Per-tab visibility variations (e.g., hide on Bracket tab).
- Multi-role indicators on a single card.
- Custom column subdivisions (e.g., splitting CMC 2 into 1-pip vs 2-pip cards).
- A play area in BuilderPage or ListDeckView.

## Open questions

None at spec time.
