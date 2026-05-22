# Theme chips on visual stacks — design

**Date:** 2026-05-22
**Area:** Deck Optimizer → visual grid (stacks)

## Problem

The optimizer's THEMES popover shows the user's selected themes with deck-membership counts (e.g. "Lifegain 42", "Lifedrain 40"), but that membership information is invisible on the cards themselves. A user looking at the stacks can't tell which cards are pulling their weight on theme synergy vs. which are generic goodstuff.

Today the deck only tracks a boolean `isThemeSynergyCard` — not *which* theme(s) a card came from.

## What's already there

- `themeDataCacheRef` in [DeckOptimizer.tsx:111](../../../src/components/deck/optimizer/DeckOptimizer.tsx#L111) is a `Map<slug, EDHRECCommanderData>` holding each fetched theme's full card pool. The "Lifegain 42" counts in the THEMES popover are just `deck ∩ themePool.allNonLand`.
- The visual stacks render in [StacksColumn.tsx](../../../src/components/deck/visualGrid/StacksColumn.tsx) and already show role badges (RAMP / DRAW / WIPE / REMOVAL) on each card.
- Stacks header sort modes: `Name | Color | Role | Price` (see DeckDisplay).

So all the inputs needed for per-card theme tagging are already in memory; this feature is mostly UI plumbing.

## Scope

**In scope**
- Per-card theme chips on cards in the visual stacks (optimizer view).
- A `Theme` sort option in the stacks header.
- Tagging is limited to the **selected (detected)** themes shown in the THEMES popover — the top 1–2, not all evaluated. Theme #1 maps to the popover's violet chip; theme #2 maps to the amber chip.

**Out of scope**
- Showing chips for all 4 evaluated themes.
- Surfacing theme chips outside the optimizer (analyze view, list view, etc.).
- Changing how themes are detected, scored, or selected.

## Design

### 1. Theme membership map

In [DeckOptimizer.tsx](../../../src/components/deck/optimizer/DeckOptimizer.tsx), after analysis completes and the selected themes are known, build:

```ts
type ThemeMembership = {
  // Display order matches popover: index 0 = theme #1 (violet), index 1 = theme #2 (amber)
  themes: { slug: string; name: string }[];
  // cardName (lowercased) → indices into `themes` it belongs to
  byCard: Map<string, number[]>;
};
```

- Iterate the **selected** matched themes (≤ 2). For each, look up its `EDHRECCommanderData` in `themeDataCacheRef`. Walk its `allNonLand` (and `lands` if we want to cover lands too) and stamp the card name into the map.
- Lowercase keys for case-insensitive lookup.
- Recompute when the analysis or selected themes change. Cache as `useMemo` over the relevant refs/state.

Pass the membership object down to the deck display → stacks column via a new optional prop (`themeMembership?: ThemeMembership`). When absent (non-optimizer surfaces), the feature is silently skipped.

### 2. Chip rendering

On each card in [StacksColumn.tsx](../../../src/components/deck/visualGrid/StacksColumn.tsx), if the card name has any entry in `themeMembership.byCard`, render small numbered dot chips alongside the existing role badges:

- Chip = small pill, single digit (`1` or `2`), about the size of a role badge.
- Colors follow the popover:
  - Theme #1 → violet (matches the existing lavender/violet accent already used for synergy)
  - Theme #2 → amber
- Two chips side by side when a card is in both.
- Tooltip on hover: theme name (e.g. "Lifegain").
- Chip slot sits next to the role badge column (same row), placed so it doesn't overlap card art or the role badge.

No theme name is rendered on the chip itself — long names ("+1/+1 Counters", "Toughness Matters") don't fit, and the numbered+colored convention is already what the popover trains the user on.

### 3. `Theme` sort option

Add a new sort key `theme` to the stacks header (after `Role`, before `Price`):

```
Name | Color | Role | Theme | Price
```

Sort order when `theme` is active:

1. Cards in **both** themes (group A)
2. Cards in **theme #1 only** (group B)
3. Cards in **theme #2 only** (group C)
4. Cards in **no theme** (group D)

Within each group, fall back to the existing default secondary sort (name). Direction toggle (asc/desc) flips the group order.

If no `themeMembership` is provided, the `Theme` option is hidden from the sort dropdown.

### 4. Touched files

- `src/components/deck/optimizer/DeckOptimizer.tsx` — build `themeMembership` and thread it down.
- `src/components/deck/DeckDisplay.tsx` (or wherever the optimizer composes the stacks view) — accept and forward the prop.
- `src/components/deck/visualGrid/StacksColumn.tsx` — render chips, add `theme` sort mode.
- Possibly a small helper module `src/components/deck/visualGrid/themeChip.tsx` for the chip + tooltip, to keep StacksColumn lean.

### 5. Edge cases

- **One theme selected** — only chip `1` (violet) appears anywhere; group C is empty in the theme sort.
- **Zero themes selected** — `themeMembership.themes` is empty; chips are off, `Theme` sort option is hidden.
- **Theme data still loading** — `themeMembership` is undefined until ready; the UI silently falls back to no chips, no theme sort. No spinner needed.
- **Card name casing** — use a lowercase key for lookups (card names from EDHREC and Scryfall sometimes differ in punctuation but match on normalized form; lowercase is sufficient for the common case).
- **Lands** — include theme lands in the map. Lands rendered in the Lands tab can be excluded from the chip render for now (chips appear only in the Non-lands stacks); revisit if useful.

## Non-goals

- No new analytics events.
- No persisted sort preference — the existing sort state behavior carries over unchanged.
- No changes to the THEMES popover.
