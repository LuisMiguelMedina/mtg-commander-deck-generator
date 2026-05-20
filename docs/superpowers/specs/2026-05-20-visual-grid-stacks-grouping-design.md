# Visual Grid: Stacks Layout & Group-By Options

**Status:** Approved
**Date:** 2026-05-20

## Goal

Bring Moxfield-style flexibility to the Visual Grid view of `DeckDisplay`. Users keep the existing packed-grid layout but gain a Stacks sub-layout and a Group-by selector that controls how cards are bucketed within the view.

## Non-goals

- No changes to the List view.
- No new top-level view modes (no Text/Table/Spoiler).
- No changes to the existing Sort dropdown — sort continues to operate within each group.
- No changes to edit-mode behavior, selection, swap menus, badges, or overlays.

## Scope

Only the Visual Grid render branch in `src/components/deck/DeckDisplay.tsx` is touched, plus a small amount of localStorage-backed state.

## UI Additions

Two new controls live in the deck toolbar, visible only when Visual Grid mode is active:

1. **Layout toggle** — small icon toggle between:
   - **Grid** (current packed grid; default)
   - **Stacks** (cards overlap vertically in columns, Moxfield style)
2. **Group dropdown** — shadcn `<Select>` with options:
   - Type *(default — current behavior)*
   - Mana Value
   - Color
   - Color Identity
   - Rarity
   - Role
   - No Grouping

Order in toolbar (left-to-right within the existing cluster): Sort, Group, Layout, Show, view-mode icons. Mobile keeps icon-only treatment with `hidden sm:inline` on labels.

## Grouping Logic

A pure helper builds groups from the same `groupedCards`/card list the grid already uses:

```
groupCardsBy(cards, groupKey) -> { [groupLabel: string]: CardEntry[] }
```

| Group key      | Buckets (in display order)                                                              |
|----------------|------------------------------------------------------------------------------------------|
| `type`         | Existing `TYPE_ORDER` (Commander, Planeswalker, Creature, Sorcery, …, Land)              |
| `cmc`          | `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7+` — lands shown as a separate trailing `Lands` bucket |
| `color`        | White, Blue, Black, Red, Green, Multicolor, Colorless — by `card.colors`                  |
| `colorIdentity`| White, Blue, Black, Red, Green, Multicolor, Colorless — by `card.color_identity`           |
| `rarity`       | Mythic, Rare, Uncommon, Common, Special                                                  |
| `role`         | Ramp, Removal, Boardwipe, Card Draw, Other — uses existing `card.deckRole`/`cardMatchesRole` |
| `none`         | Single `All Cards` bucket                                                                 |

Commander is always pinned at the top regardless of grouping (its own bucket, label `Commander`).

Empty buckets are skipped.

## Stacks Layout

Each group renders as a column (or columns, on wider viewports) of overlapping card images. Reference behavior:

- Columns laid out with `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` (one column per group, group header above).
- Within a column, each card image is absolutely positioned with `top: index * stackOffset`; `stackOffset` ≈ 28px (enough to show name + mana cost strip).
- Column container height = `stackOffset * (count - 1) + cardHeight`.
- Last card in a column shows fully; earlier cards show only the top strip.
- Hover: card lifts (`z-10`, slight `translateY(-4px)`) to reveal full art without affecting layout.
- All current overlays (quantity, sort badges, role badges, GC/pin/ban, MDFC flip, context menu) render on the card the same way as in Grid layout.
- Click behavior identical to Grid (preview modal, or select in edit mode).

## State & Persistence

Three new pieces of UI state on `DeckDisplay`:

```ts
const [gridLayout, setGridLayout] = useState<'grid' | 'stacks'>(loadFromLS('deck-grid-layout', 'grid'));
const [groupBy, setGroupBy]       = useState<GroupKey>(loadFromLS('deck-group-by', 'type'));
```

Persistence keys (follow existing pattern in the file):

- `deck-grid-layout`
- `deck-group-by`

`GroupKey` is a new type added near other UI-state types:

```ts
type GroupKey = 'type' | 'cmc' | 'color' | 'colorIdentity' | 'rarity' | 'role' | 'none';
```

## Interaction with Existing Features

- **Sort** still applies within each group (e.g., sort by Mana Value while grouped by Color works as expected).
- **Search filter** (`combinedMatchingIds`) still filters cards before grouping; empty groups are hidden.
- **Collapse/expand** — `collapsedGridCategories` is keyed by group label, so it works automatically for any `GroupKey`. Caveat: switching `groupBy` clears the collapse set to avoid stale labels carrying over.
- **Edit mode** — selection, swap candidates, banned/must-include all unchanged.
- **Commander pin** — Commander always rendered as the first group regardless of `groupBy`.

## Architecture

To keep `DeckDisplay.tsx` manageable, extract the grouping helper to its own module:

- New file: `src/components/deck/visualGrid/grouping.ts`
  - Exports `GroupKey`, `groupCardsBy()`, `GROUP_OPTIONS` (label/value pairs for the dropdown).
- New file: `src/components/deck/visualGrid/StacksColumn.tsx`
  - Renders one stacked column for a given group. Accepts the card list, overlay-rendering props, and the same handlers the current grid uses.
- `DeckDisplay.tsx` imports both, replaces the inline grid loop with:
  - `if (gridLayout === 'stacks')` → render `<StacksColumn>` per group.
  - else → render existing packed grid per group.

The current per-card overlay JSX is large and duplicated in two places. Extract it to a `CardTile` sub-component in `visualGrid/CardTile.tsx` shared by both layouts to avoid drift.

## Testing

- Manually verify each Group option produces the expected buckets on a real deck (lands, multicolor cards, role-stamped non-creatures, dual-faced cards).
- Verify Stacks layout: overlap height, hover lift, no overlay clipping (badges visible on the top strip).
- Verify localStorage round-trip (refresh keeps Stacks + chosen Group).
- Verify edit-mode selection/swap still works under Stacks.
- Verify filter-search hides empty groups under each `groupBy`.

## Rollout

Single PR. Grid remains the default layout so existing users see no change unless they opt in via the new toggle.
