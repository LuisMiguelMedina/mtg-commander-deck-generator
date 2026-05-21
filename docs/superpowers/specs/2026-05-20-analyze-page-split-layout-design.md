# Analyze Page — Resizable Two-Column Split Layout

**Date:** 2026-05-20
**Status:** Approved, ready for implementation plan

## Problem

The Analyze page currently stacks two heavy components vertically: `DeckOptimizer` (Overview / Roles / Mana / Tempo / Bracket tabs with recommendations) above `DeckBuildingArea` (the deck grid/stacks/list). Users scroll back and forth between "what should I change" and "what's in the deck." On wide screens this wastes horizontal space.

## Goal

Show analyzer and deck side-by-side at desktop sizes, with a draggable divider so the user can rebalance the split for their workflow.

## Architecture

Use [`react-resizable-panels`](https://www.npmjs.com/package/react-resizable-panels) to split the loaded-deck view into two horizontally-resizable panes. Mobile/tablet (<`lg`) keeps today's stacked layout.

```
┌─────────────────────────────────────────────────────────────┐
│ CommanderStrip (full width — unchanged)                     │
├──────────────────────────────┬──────────────────────────────┤
│  DeckOptimizer               ║  DeckBuildingArea            │
│  (Overview / Roles / Mana    ║  (deck grid / stacks /       │
│   / Tempo / Bracket tabs)    ║   list, filters, etc.)       │
│  own scroll                  ║  own scroll                  │
└──────────────────────────────╨──────────────────────────────┘
                               ↑ drag handle
```

### Breakpoint behavior

- **`lg` and up (≥1024px):** two-column split, resizable divider, independent scroll per pane.
- **Below `lg`:** current stacked layout (deck above optimizer per existing JSX order) — no divider rendered.

### Default split & persistence

- Initial split: **55% analyzer / 45% deck**.
- Min size per pane: **30%**.
- Saved per-user in localStorage via the library's `autoSaveId="analyze-split"`.

### Independent scroll

Each pane gets `overflow-y-auto` and a fixed viewport height (`calc(100vh - <header+strip height>)`). The optimizer's tab bar stays visible while the user scrolls its content; the deck's toolbar (sort/group/show) stays visible while scrolling the card list.

### Behavior change: Optimize Deck view

Today, clicking **"Optimize Deck"** sets `optimizeViewActive=true` and hides `DeckBuildingArea` entirely so the optimize view takes the whole page. In the split layout this is removed — the optimize view lives in the left (analyzer) pane only, and the deck stays visible on the right.

Specifically: drop the `!optimizeViewActive &&` gate around `<DeckBuildingArea>` in [src/pages/AnalyzePage.tsx](src/pages/AnalyzePage.tsx). The `deck-optimizer-state` event listener and `optimizeViewActive` state can stay (the optimizer still uses it internally for its `activeOptimizerRole` highlighting on the right pane), but it no longer controls deck visibility.

### Drag handle styling

- 2px vertical line, `border/40` resting state.
- Widens to `violet-400/60` on hover and during drag.
- `cursor-col-resize`, ~8px hit area (transparent padding around the visible line).
- Matches the existing lavender accent.

## Files touched

- **New:** [src/components/analyze/AnalyzeSplit.tsx](src/components/analyze/AnalyzeSplit.tsx) — small component owning the split layout, handle, and the responsive switch between split and stack. Keeps `AnalyzePage.tsx` readable.
- **Modified:** [src/pages/AnalyzePage.tsx](src/pages/AnalyzePage.tsx) — replace the inline `<DeckBuildingArea>` + `<DeckOptimizer>` render with `<AnalyzeSplit analyzer={...} deck={...} />`. Drop the `!optimizeViewActive &&` gate.
- **Modified:** `package.json` — add `react-resizable-panels` dependency.

## Out of scope

- Vertical resizing or three-pane layouts.
- Changing optimizer or deck-view internals (each must work in a narrower column, but no redesign of either).
- Mobile/tablet redesign — they keep today's stacked behavior.

## Success criteria

- At `lg+` widths the page renders analyzer left, deck right, with a draggable divider.
- Dragging the divider resizes both panes smoothly; ratio persists across reloads.
- Each pane scrolls independently; sticky tab bars stay visible.
- Clicking "Optimize Deck" no longer hides the right pane.
- Below `lg` the layout falls back to today's stacked rendering.
