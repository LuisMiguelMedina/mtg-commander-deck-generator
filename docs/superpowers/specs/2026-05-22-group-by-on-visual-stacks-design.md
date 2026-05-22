# Group-by selector on visual stacks — design

**Date:** 2026-05-22
**Area:** Analyze page → visual stacks (DeckBuildingArea)

## Problem

The visual stacks currently group cards by **CMC columns** (0, 1, 2, … 7+) with a creatures/noncreatures row split. There's no way to see a different cut — e.g. "show me all my Lifegain cards together" — which is exactly what the new theme tagging makes interesting. The recently added `Theme` sort key tries to do this via reordering inside CMC columns, but reordering within columns is a weak way to convey grouping. Promoting grouping to a first-class layout dimension is cleaner and sets up Role / Type grouping as a bonus.

## What's already there

- [DeckBuildingArea.tsx](../../../src/components/analyze/DeckBuildingArea.tsx) renders the current layout: CMC columns × creatures/noncreatures rows. Lands have a separate Lands view.
- `themeMembership` (from the prior spec) is already threaded into the component and maps card name → theme indices (primary / secondary).
- Sort chip strip (`Name | Color | Role | Theme | Price`) is in the toolbar. The `Theme` sort key was added last round.

## Scope

**In scope**
- A new top-level **Group** selector in the stacks toolbar: `CMC | Theme | Role | Type | None`.
- Default = `CMC` (today's behavior).
- Grouping replaces the **column dimension**. The creatures/noncreatures row split stays in all groupings.
- Sort chips still work — they sort *within* whatever the columns are.
- Theme grouping is the headline win; Role / Type / None are easy follow-ons since the same machinery covers them.
- Remove the `Theme` chip from the **sort** strip — group-by is the better home for that intent. Other sort chips (Name, Color, Role, Price) remain.
- Persist the chosen grouping to localStorage (key: `analyze-play-area-group`).

**Out of scope**
- Grouping the **Lands** view — it already has its own land-category columns (Basic/MDFC/Channel/Tap/Utility/Other). Leave it untouched.
- Group-by anywhere outside the analyze visual stacks (deck display, list view).
- New analytics events.

## Design

### 1. Toolbar UI

Add a new chip strip next to the existing sort chip strip, with a small icon (e.g. Lucide `LayoutGrid` or `Group`):

```
[layout icon]  CMC | Theme | Role | Type | None        [arrow icon]  Name | Color | Role | Price
```

- Active chip uses the same `bg-accent` treatment as the active sort chip.
- The strip is hidden on tiny screens the same way the sort strip is (existing pattern carries over).
- `Theme` is disabled (greyed, tooltip "Select themes first") when no themes are selected (`themeMembership` null / empty).

### 2. Column dimension

Replace the current `activeCmcs` array driving the columns with a generic `columns` array:

```ts
type GroupKey = 'cmc' | 'theme' | 'role' | 'type' | 'none';

interface Column {
  key: string;        // stable identity for React key + sort within
  label: string;      // header text
  count?: number;     // displayed in parentheses next to label
  matches: (card: ScryfallCard) => boolean;
}
```

A pure helper `getColumns(groupKey, ctx)` returns `Column[]` based on the chosen grouping and current context (`themeMembership`, deck cards). Empty columns are dropped (same rule as today's `activeCmcs`).

Column definitions per group:

- **`cmc`** — `0, 1, 2, 3, 4, 5, 6, 7+`. Matches `Math.min(floor(cmc), 7) === col.cmc`.
- **`theme`** — `theme #1 only`, `Both`, `theme #2 only`, `Off-theme`. Header text uses the real theme names from `themeMembership.themes`. When only one theme is selected, columns collapse to `theme #1`, `Off-theme`.
- **`role`** — `Ramp | Removal | Wipes | Draw | Other`. Matches `card.deckRole` (Other = no role).
- **`type`** — `Creature | Planeswalker | Artifact | Enchantment | Instant | Sorcery | Battle | Other`. Matches the front-face type line. Honors the existing creatures-row vs noncreatures-row split: under Type grouping, the row split is redundant (each row holds exactly one type), so collapse the rows into a single row. *(One small concession to the "keep the row split" rule — Type grouping is the one place it doesn't make sense.)*
- **`none`** — single column `All`. Same row split.

### 3. Row split

The creatures/noncreatures row split survives for every grouping **except** `type` (where rows would be one-to-one with columns). For `type`, render a single row of stacks.

The two-row layout for `cmc | theme | role | none` is identical to today: a creatures `CurveRow` above a noncreatures `CurveRow`, both keyed on the new `columns` array.

### 4. Sort interaction

Sort chips operate within each column unchanged. The standalone `Theme` sort option goes away (it conflicts with group-by-Theme and is strictly worse). Sort defaults stay: Name asc, Color asc, Role asc, Price desc.

If the user had `theme` saved in `analyze-play-area-sort`, fall back to `name` on next load. (Sort key migration is one line in the parser.)

### 5. Theme chips on cards

The theme chips added in the previous round currently render only when sort = `theme`. With group-by replacing that sort, change the gating to: render theme chips when `groupKey === 'theme'`. (Same idea — only show when relevant — just a different trigger.)

### 6. Persistence

```ts
const GROUP_STORAGE_KEY = 'analyze-play-area-group';
```

Load on init, write on change. Validate the stored value against the `GroupKey` union; fall back to `'cmc'`.

### 7. Empty / loading states

- Theme grouping when membership is loading: render columns as today's CMC view until membership arrives (don't flash an empty theme view).
- Theme grouping when membership clears (themes deselected): silently fall back to CMC grouping and update the toolbar selection.

### 8. Touched files

- `src/components/analyze/DeckBuildingArea.tsx` — toolbar additions, group state, generic column derivation, row rendering, remove `theme` from sort strip.
- A new helper: `src/components/analyze/groupColumns.ts` — pure `getColumns(groupKey, ctx)` returning `Column[]`. Keeps DeckBuildingArea from growing further.

## Non-goals

- No nesting (no "group by Theme, then by CMC" two-axis matrix).
- No drag-to-reorder columns.
- No saving group preference per commander — it's a global preference like the sort key.

## Out-of-scope follow-ups (mention only)

- Group-by **Color Identity** — easy to add later (column = `W / U / B / R / G / Multi / Colorless`).
- Showing per-column **totals** with a small badge (currently shown via the `(N)` in CMC labels; will carry over for free).
