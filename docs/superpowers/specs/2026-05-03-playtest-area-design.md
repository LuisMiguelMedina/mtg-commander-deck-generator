# Playtest Area — Design

## Goal

Add a Moxfield-style solitaire goldfish playtest area to the deck view, accessible from both
generated decks (BuilderPage) and saved decks (ListDeckView). The goal is to let users actually
play out their deck against an empty board: draw, mulligan, scry, search, drag cards onto a
free-positioning battlefield, tap, add counters, attach auras, spawn tokens, undo, and reset.

This is a single-player tool — no opponents, no AI, no networking. No save/load of game state.

## Non-goals

- No multiplayer or hot-seat play
- No life trackers for opponents
- No save/restore of mid-game state across page reloads
- No turn enforcement or rules engine — players move cards manually; the app does not validate
  legality
- No combat math, no stack visualization
- No game state sharing between users

## Entry points

Two new routes added to the React Router config in [App.tsx](../../../src/App.tsx):

- `/playtest/list/:listId` — playtest a saved `UserCardList`. Looked up via `useUserLists`.
  If the list does not exist, render a "deck not found" empty state with a "Back" link to
  `/lists`.
- `/playtest/generated` — playtest the in-memory generated deck from the main Zustand store
  (`useStore(s => s.generatedDeck)`). If the generated deck is `null` (refresh, direct nav),
  redirect to `/` with a toast: "Generated deck not found — start a new build".

A "Playtest" button is added to the toolbar in two places:

- [BuilderPage.tsx](../../../src/pages/BuilderPage.tsx) — next to the existing Export button
  in the deck-display toolbar. Navigates to `/playtest/generated`. Disabled when no deck is
  generated.
- [ListDeckView.tsx](../../../src/components/lists/ListDeckView.tsx) — next to the existing
  Export button. Navigates to `/playtest/list/{list.id}`.

## Module layout

```
src/
  pages/
    PlaytestPage.tsx           // route entry — hydrates store, mounts <DndContext>, renders layout
  components/
    playtest/
      PlaytestToolbar.tsx      // top bar: exit, deck name, phase, turn, draw/untap/shuffle/mulligan/search/scry/tokens/undo/reset
      PlaytestSidebar.tsx      // left rail: life, command zone, library, graveyard, exile piles
      Battlefield.tsx          // free-position absolute layer + DnD drop zone
      BattlefieldCard.tsx      // single permanent: tap, counters, attachments, face-down, right-click menu
      Hand.tsx                 // bottom card fan, sortable, draggable
      GameLog.tsx              // right rail (collapsible), scrollback
      modals/
        MulliganModal.tsx
        SearchLibraryModal.tsx
        ScryMillSurveilModal.tsx
        ZoneViewerModal.tsx    // generic full-grid view of one zone
        TokenSpawnModal.tsx
      hooks/
        useHotkeys.ts          // D, U, S, M, T, Esc, Ctrl+Z, 1-7
  store/
    playtestStore.ts           // Zustand slice — state + actions, isolated from main store
  services/
    playtest/
      tokens.ts                // resolves token list for the deck (EDHREC + Scryfall fallback)
      libraryBuilder.ts        // builds shuffled library from a deck source
```

## Dependencies

Add to `package.json`:

- `@dnd-kit/core` (~20kb gz) — drag-and-drop primitives. Sensors: pointer, touch, keyboard.
- `nanoid` — short unique IDs for `BattlefieldCard.instanceId`. (Already lightweight; if not
  preferred, fall back to `crypto.randomUUID()` which is widely supported in modern browsers
  and avoids adding a dep.)

A generic MTG card-back image is added at `public/card-back.png` for face-down rendering.

## Data model

```ts
type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';

interface BattlefieldCard {
  instanceId: string;
  card: ScryfallCard;
  x: number;                          // px from battlefield top-left
  y: number;
  tapped: boolean;
  faceDown: boolean;
  counters: Record<string, number>;   // e.g. { '+1/+1': 3, 'loyalty': 5, 'storage': 2 }
  attachedTo?: string;                // instanceId of host (auras / equipment)
}

interface LogEntry {
  id: string;
  ts: number;
  text: string;
}

type ZoneKey = 'library' | 'hand' | 'graveyard' | 'exile' | 'command';

interface Zones {
  library: ScryfallCard[];     // ordered, top = index 0
  hand: ScryfallCard[];
  graveyard: ScryfallCard[];
  exile: ScryfallCard[];
  command: ScryfallCard[];
}

interface PlaytestSnapshot {
  zones: Zones;
  battlefield: BattlefieldCard[];
  life: number;
  turn: number;
  phase: Phase;
}

interface PlaytestState {
  source: { kind: 'list' | 'generated'; name: string; commanderNames: string[] };
  zones: Zones;
  battlefield: BattlefieldCard[];
  life: number;
  turn: number;
  phase: Phase;
  log: LogEntry[];
  history: PlaytestSnapshot[];        // capped at 20 — for undo
  modal:
    | null
    | { kind: 'search' }
    | { kind: 'scry' | 'mill' | 'surveil'; n: number }
    | { kind: 'zoneViewer'; zone: Exclude<ZoneKey, 'hand'> }
    | { kind: 'tokens' }
    | { kind: 'mulligan'; mulliganCount: number };
}
```

## Library hydration

`libraryBuilder.ts` exports `buildLibrary(source) → { library, command }`:

- For a `UserCardList`: iterate `list.cards`, repeating each entry `quantity` times. Skip
  cards whose name matches `list.commanderName` or partner — those go into `command`.
  `sideboard` and `maybeboard` are ignored.
- For a generated deck: flatten `Object.values(generatedDeck.categories)` (skip the commander
  category if present), separate commander/partner into `command`, rest into the library
  pool.
- Library is then Fisher-Yates shuffled.

## Zustand store actions

```ts
interface PlaytestActions {
  hydrate(source: ListSource | GeneratedSource): void;     // builds zones from source, then auto-calls dealOpeningHand
  dealOpeningHand(): void;                                  // draws 7 from library to hand + opens MulliganModal
  draw(n?: number): void;                                   // default 1
  shuffle(): void;
  mulligan(): void;                                         // London: shuffle hand back, draw 7, store mulliganCount
  keepHandSendToBottom(cardIndices: number[]): void;        // resolves the mulligan-bottom step
  untapAll(): void;
  setLife(n: number): void;
  adjustLife(delta: number): void;
  setPhase(phase: Phase): void;
  advancePhase(): void;                                      // also bumps turn on rollover from 'end' → 'untap'
  moveCard(args: MoveArgs): void;                            // unifies all zone↔zone moves
  toggleTap(instanceId: string): void;
  toggleFaceDown(instanceId: string): void;
  setCounter(instanceId: string, type: string, value: number): void;
  copyCard(instanceId: string): void;                        // duplicates a battlefield permanent
  attach(childId: string, parentId: string): void;
  unattach(instanceId: string): void;
  spawnToken(card: ScryfallCard): void;
  scry(n: number, decisions: ('top' | 'bottom')[]): void;
  surveil(n: number, decisions: ('top' | 'graveyard')[]): void;
  mill(n: number): void;
  searchLibraryTakeToHand(cardId: string): void;             // also shuffles
  reset(): void;                                             // re-runs hydrate from same source
  undo(): void;
  openModal(modal: PlaytestState['modal']): void;
  closeModal(): void;
}
```

`MoveArgs` is a discriminated union covering all (source, target) combinations including
battlefield drops with `{x, y}`. Every state-changing action pushes a `PlaytestSnapshot` onto
`history` (capped at 20) before mutating, except `undo`, modal open/close, and log appends.

## Drag and drop

Single `<DndContext>` at the top of `PlaytestPage`. Sensors: `PointerSensor` (with 5px
activation distance, matching TestHand), `TouchSensor`, `KeyboardSensor`.

Draggables:
- Hand cards (one per `useDraggable`)
- Battlefield cards
- Pile top-card representatives (drag the top of library/graveyard/exile)

Droppables:
- Battlefield (large droppable, captures `{x, y}` on drop via `over.rect` + delta)
- Each sidebar pile (library top, library bottom, graveyard, exile, command)
- Hand
- Each `BattlefieldCard` (nested droppable for aura/equipment attachment — only accepts
  draggables tagged as `aura` or `equipment` based on type_line)

`onDragEnd`:
1. Compute target zone from `over.id`.
2. Compute source from the drag's data payload.
3. Call `moveCard(...)` — store handles all cases including battlefield drops, attachments,
   and zone-to-zone.

**Arrival snap rule (battlefield):** the snap applies only when a card *arrives* on the
battlefield from another zone (hand, library, etc.) — lands snap to the bottom band
(`containerHeight - cardHeight - 16`), non-lands snap to the top band (`16`); x = drop
pointer x. Once a card is on the battlefield, subsequent drags within the battlefield use
the raw drop position with no snap.

## Battlefield rendering

- Container: `position: relative`, fills available space between toolbar/sidebar/hand.
- Each `BattlefieldCard` is `position: absolute; left: x; top: y`.
- Tap state composed via wrapper rotation:
  ```
  <div style="rotate:tapped ? 90deg : 0">
    <img …card image… />
    <div className="counter-chips" style="rotate: -tapped ? 90deg : 0">
      … chips render upright even when card is tapped …
    </div>
  </div>
  ```
- Counter chips: small rounded pills at bottom of card. Click increments, shift-click
  decrements, alt-click removes. Chip color hue is type-dependent (green for `+1/+1`, red for
  `-1/-1`, blue for `loyalty`, neutral for custom).
- Attachments: rendered after parent in DOM order with computed offsets — child y =
  parent.y + 24 (per attachment depth), child x = parent.x + 12. Moving the parent updates
  attached children together via a derived selector.

## Right-click context menu

Reuse the existing `Popover` pattern (anchored on right-click position via a portal). Items:

- → Hand
- → Library top / Library bottom
- → Graveyard
- → Exile
- → Command zone
- (separator)
- Tap / Untap (battlefield only)
- Flip face-down (battlefield only)
- Add counter ▸ (+1/+1, -1/-1, loyalty, charge, storage, custom…)
- Create copy (battlefield only)
- Unattach (battlefield, only when `attachedTo` is set)
- (separator)
- Cancel

Hand cards get a subset (no tap/counters/attach). Pile cards (when viewing a zone) also get
the move actions.

## Modals

All modals use a fullscreen overlay div (matching `CardPreviewModal`'s pattern). They can be
closed with `Esc`. The store's `modal` field tracks which modal is open; only one at a time.

- **Mulligan**: opens automatically after `dealOpeningHand` and after each `mulligan` call.
  Shows the current 7 with three options: "Keep this hand" (advances to bottom-N picker if
  `mulliganCount > 0`), "Mulligan again" (calls `mulligan`), "Cancel" (keeps current state).
  Bottom-N picker: select `mulliganCount` cards from the hand to send to bottom of library.
- **Search Library**: full-grid of `library` cards, name+type filter input, click a card to
  call `searchLibraryTakeToHand(cardId)` (which also shuffles).
- **Scry / Mill / Surveil**: input N (default 1, range 1–10), shows top N. Scry: drag to
  reorder + per-card "send to bottom" toggle. Surveil: per-card "Top" / "Graveyard" toggle.
  Mill: just a confirmation showing what's about to be milled.
- **Zone Viewer**: full-grid of any zone except hand. Each card has the same right-click
  context menu.
- **Token Spawn**: lists tokens. Source: `services/playtest/tokens.ts` returns
  `(commanderName) → ScryfallCard[]`. First tries the EDHREC commander payload (already
  cached during deck gen — exposed via the deck source), falling back to a Scryfall query
  `is:token c<=<colorIdentity>`. Click a token → `spawnToken(card)` adds it to the
  battlefield at center.

## Hand

- Card fan rendered like the existing `TestHand` (overlap, hover-lift, drag-to-reorder),
  but each card is a `useDraggable` with the hand index in its drag data.
- Sort dropdown (top-right of hand area): None / CMC / Type — uses `getFrontFaceTypeLine`
  for type. Sort is a *display* sort: it does not mutate `zones.hand` order; it's a render
  permutation only. (Mulligan order picking uses the underlying `zones.hand` array order.)
- Drag from hand onto:
  - Battlefield → adds a `BattlefieldCard` (with first-drop snap rule applied)
  - Sidebar pile → moves to that zone
  - Existing battlefield card (only if dragged card is aura/equipment) → attaches

## Sidebar piles

Each pile renders the top card image (face-down for library) plus a count badge. Click →
opens `ZoneViewerModal` for that zone. Right-click:

- Library: Shuffle / Search / View / Move all to graveyard
- Graveyard: View / Move all to library (shuffles) / Move all to exile
- Exile: View
- Command: View / Send to library bottom (and shuffle)

Drag-from-pile: drags the top card.

## Toolbar

Layout (left to right):
- `← Exit` button — `useNavigate` back to the originating deck view (uses
  `location.state.from` if set, else router back).
- Deck name (read-only)
- Phase indicator: chip showing current phase, click to advance via `advancePhase`.
- Turn counter
- (spacer)
- Action buttons: Draw · Untap All · Shuffle · Mulligan · Search · Scry/Mill/Surveil split
  button · Tokens · Undo · Reset

## Life

Top of left rail. Big number, ±1 / ±5 buttons, click number to type. Default 40.

## Game log

Right rail, collapsible. `LogEntry[]`, auto-scrolls to bottom on append. Cleared on Reset.
Mulligan inserts a "— Mulligan to N —" separator entry. Generated by every action in the
store (e.g., `draw` → "Drew Sol Ring"; `setCounter` → "+1 +1/+1 on Atraxa"; `moveCard` →
"Forest → Graveyard").

## Hotkeys

Bound on `PlaytestPage` via `useHotkeys`. Ignored when a modal is open or an `<input>` /
`<textarea>` has focus.

| Key       | Action |
| --------- | ------ |
| `D`       | Draw 1 |
| `U`       | Untap all |
| `S`       | Shuffle |
| `M`       | Mulligan |
| `T`       | Toggle tap on hovered battlefield card |
| `Esc`     | Close active modal |
| `Ctrl+Z`  | Undo |
| `1`–`7`   | Set phase to Nth phase (1=untap … 7=end) |

## Undo

Every state-changing action pushes a snapshot before mutation. `undo()` pops the latest
snapshot and applies it. History is capped at 20; oldest dropped. Snapshots cover `zones`,
`battlefield`, `life`, `turn`, `phase` — not `log`, `history`, or `modal`. Undoing does not
re-open modals.

## Edge cases

- **Empty library on draw** — toast "Library is empty"; log "Decked out". No crash, no
  auto-loss.
- **DFC cards** — show front face by default in hand and battlefield. Battlefield right-click
  → "Flip face" toggles which face renders, using existing `getCardBackFaceUrl` and
  `isDoubleFacedCard` from `scryfall/client.ts`.
- **MDFC lands** (`isMdfcLand`) — counted as non-land for the first-drop snap rule (snap to
  top band). User can drag to bottom band manually.
- **Saved list with `quantity > 1`** — library is built by repeating entries, then shuffled.
- **Sideboard / maybeboard** — ignored entirely. Only `cards` is used.
- **Commander handling** — if `source.commanderNames` is non-empty, those cards start in
  `zones.command` and are not in the library.
- **Browser refresh on `/playtest/generated`** — generated deck is gone on refresh; redirect
  to `/` with a toast.
- **No save warning** — there's no save anyway, so no `beforeunload` prompt.

## Testing

This project does not have a test framework configured (no Jest/Vitest in `package.json`,
no `*.test.ts` files in `src/`). Verification follows the project's existing
manual-verify convention:

1. `npm run lint` → green
2. `npm run build` → green
3. Manual smoke flow (both entry points):
   - Open generated deck → click Playtest → mulligan once → keep 7 → draw 5 → drag two lands
     and a creature to battlefield → tap a land → add `+1/+1` counter to creature → drag aura
     onto creature → confirm visual nesting → move creature to graveyard → undo → confirm
     state restored → reset → confirm fresh state.
   - Open saved list → click Playtest → repeat the smoke flow.
4. Mobile spot-check: drag works via touch, modals close via tap-outside.

Adding Vitest is explicitly out of scope for this work to match existing project convention.
If unit testing the store becomes necessary later, that's a separate task.

## Out of scope (explicit)

- Multiplayer or hot-seat play
- AI opponent
- Save/restore mid-game state
- Life trackers for opponents
- Stack visualization
- Combat damage math
- Game state sharing / spectating
- Vitest setup
- Sideboarding mid-game

## Open implementation questions for the plan

These are intentionally deferred to writing-plans; flagged here so the planner picks them up:

- Exact dnd-kit collision algorithm choice (`closestCenter` vs `pointerWithin`) for the
  battlefield + nested attachment droppables — needs a quick spike.
- Whether to use `nanoid` or `crypto.randomUUID()` for `instanceId`.
- Performance: with 50+ permanents on the battlefield, do we need to memoize per-card
  selectors from the Zustand store?
- Card-back asset: confirm we can ship a generic MTG-styled card back image without trademark
  concerns, or use a neutral abstract back.
