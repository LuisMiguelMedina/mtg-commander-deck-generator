# Analyze Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/analyze` page that promotes the existing `DeckOptimizer` to its own surface — a multi-source hub (Paste / My Lists / Generate) that retires the inline EA-gated mounts on `BuilderPage` and `ListDeckView`, and graduates the analyzer from EA to GA.

**Architecture:** A new `AnalyzePage` route at `/analyze` with two states: (1) an empty **hub** showing pill-tab lanes for paste/lists/generate, and (2) a **loaded** state with a thin commander strip + the existing `DeckOptimizer` rendered full-width. Deck hydration mirrors the existing `ListDeckView` pattern (`enrichDeckCards` + Scryfall + tagger). State handoff from `BuilderPage` reads `generatedDeck` from the Zustand store; from `ListDeckView`, via `?listId=` query param. The `DeckOptimizer` component itself is not touched.

**Tech Stack:** React 18, TypeScript, Vite, React Router 7, Zustand 5, Tailwind, shadcn/ui (Button/Input/Popover), Lucide icons. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-19-analyze-page-design.md](../specs/2026-05-19-analyze-page-design.md)

---

## Verification Convention

The project does not have a unit test framework configured. Every task verifies via:

1. `npm run lint` → must be green (no new errors).
2. `npm run build` → must succeed (TypeScript + Vite production build).
3. **Manual smoke** — task-specific behavior to exercise in `npm run dev` (run on `http://localhost:5173/mtg-commander-deck-generator/`).
4. **Commit** with the message shown in the task.

When a task says "Lint+build+smoke" — do not skip these. They replace the automated test step.

---

## File Structure

**New files:**

```
src/
  pages/
    AnalyzePage.tsx                                    # route entry, hub + loaded states
  components/
    analyze/
      AnalyzeHero.tsx                                  # title + subtitle (empty state only)
      LaneTabs.tsx                                     # pill-tab control (Paste/Lists/Generate)
      PasteLane.tsx                                    # textarea + parse + commander resolution
      ListsLane.tsx                                    # grid of saved lists w/ commanders
      GenerateLane.tsx                                 # commander search → routes to /build
      WhatYoullSeeStrip.tsx                            # 5 pillar cards (Overview/Roles/Mana/Tempo/Bracket)
      CommanderStrip.tsx                               # thin strip shown above analyzer when loaded
      analyzeHydration.ts                              # pure hydration helper (paste + list paths)
```

**Modified files:**

```
src/
  App.tsx                                              # add /analyze route, reorder navbar, mobile tab
  pages/
    BuilderPage.tsx                                    # remove inline DeckOptimizer; add Analyze CTA
  components/
    lists/
      ListDeckView.tsx                                 # remove inline DeckOptimizer; add Analyze CTA
  data/
    patchNotes.json                                    # 1.3.0 entry
package.json                                            # 1.2.27 → 1.3.0
```

**Untouched (deliberate):**

- `src/components/deck/optimizer/*` — internals unchanged.
- `src/services/deckBuilder/deckAnalyzer.ts` — unchanged.
- `src/services/deckBuilder/deckEnricher.ts` — unchanged.

---

## Task 1: Scaffold `/analyze` route + stub page + navbar slot

**Files:**
- Create: `src/pages/AnalyzePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the stub `AnalyzePage`**

```tsx
// src/pages/AnalyzePage.tsx
export function AnalyzePage() {
  return (
    <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8">
      <div className="text-center py-8">
        <h2 className="text-4xl font-bold mb-4">
          Analyze any{' '}
          <span className="gradient-text">Commander deck</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          See what's strong, what's missing, and why.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the route to `App.tsx`**

In `App.tsx`, add to imports near other page imports:

```tsx
import { AnalyzePage } from '@/pages/AnalyzePage';
```

In the `<Routes>` block, insert before the metrics route:

```tsx
<Route path="/analyze" element={<Layout><AnalyzePage /></Layout>} />
```

- [ ] **Step 3: Add Microscope icon import**

In `App.tsx`, the existing lucide import line is:

```tsx
import { Settings, Sparkles, Wand2, ListChecks, Library, BarChart3 } from 'lucide-react';
```

Change it to:

```tsx
import { Settings, Sparkles, Wand2, ListChecks, Library, BarChart3, Microscope } from 'lucide-react';
```

- [ ] **Step 4: Add "Analyze" to the desktop navbar between Generate and My Lists**

In `App.tsx`, locate the existing block (≈ lines 282-302):

```tsx
<button
  onClick={handleLogoClick}
  className={`text-xs transition-colors px-2 py-1 rounded-md flex items-center gap-1.5 ${
    isCreatePage ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
  }`}
>
  Generate
</button>
<button
  onClick={() => navigate('/lists')}
  ...
>
  My Lists
  ...
</button>
```

Insert a new button between Generate and My Lists:

```tsx
<button
  onClick={() => navigate('/analyze')}
  className={`text-xs transition-colors px-2 py-1 rounded-md flex items-center gap-1.5 ${
    location.pathname.startsWith('/analyze') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
  }`}
>
  Analyze
</button>
```

- [ ] **Step 5: Add "Analyze" to the mobile bottom-tab between Generate and Lists**

In `App.tsx`, locate the mobile tab bar (the portaled `<nav>` block, ≈ lines 421-473). After the Generate button and before the My Lists button, insert:

```tsx
<button
  onClick={() => { navigate('/analyze'); window.scrollTo(0, 0); }}
  className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
    location.pathname.startsWith('/analyze') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`}
  aria-label="Analyze"
>
  <Microscope className={`w-5 h-5 ${location.pathname.startsWith('/analyze') ? 'text-primary' : ''}`} />
  <span className="text-[10px] font-medium">Analyze</span>
</button>
```

- [ ] **Step 6: Hide the commander art background on `/analyze`**

In `App.tsx`, locate the existing line (≈ line 184):

```tsx
const isCollectionPage = location.pathname === '/collection' || location.pathname.startsWith('/lists');
```

Add a new line below it:

```tsx
const isAnalyzePage = location.pathname.startsWith('/analyze');
```

Then update the existing background-render guard (≈ line 248):

```tsx
{!isCollectionPage && <CommanderBackground commander={commander} deckGenerated={!!generatedDeck} />}
```

Change to:

```tsx
{!isCollectionPage && !isAnalyzePage && <CommanderBackground commander={commander} deckGenerated={!!generatedDeck} />}
```

(The background returns once a deck is loaded into the analyzer — Task 6 re-introduces it for the loaded state.)

- [ ] **Step 7: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Navbar now reads `Generate · Analyze · Lists · Collection` on desktop.
- Mobile bottom-tab has the same four entries with a microscope icon for Analyze.
- Clicking Analyze routes to `/analyze` and shows the title/subtitle.
- The page has no commander art background even if a commander is in the Zustand store.

- [ ] **Step 8: Commit**

```bash
git add src/pages/AnalyzePage.tsx src/App.tsx
git commit -m "feat(analyze): scaffold /analyze route and navbar slot"
```

---

## Task 2: Build the lane tab control + "What we'll see" pillar strip

**Files:**
- Create: `src/components/analyze/LaneTabs.tsx`
- Create: `src/components/analyze/WhatYoullSeeStrip.tsx`
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Create `LaneTabs.tsx`**

```tsx
// src/components/analyze/LaneTabs.tsx
import { ClipboardPaste, Library, Sparkles } from 'lucide-react';

export type LaneKey = 'paste' | 'lists' | 'generate';

const TABS: { key: LaneKey; label: string; icon: typeof ClipboardPaste }[] = [
  { key: 'paste',    label: 'Paste',     icon: ClipboardPaste },
  { key: 'lists',    label: 'My Lists',  icon: Library },
  { key: 'generate', label: 'Generate',  icon: Sparkles },
];

interface LaneTabsProps {
  active: LaneKey;
  onChange: (k: LaneKey) => void;
}

export function LaneTabs({ active, onChange }: LaneTabsProps) {
  return (
    <div role="tablist" aria-label="Choose how to load a deck" className="flex items-center gap-1.5 justify-center mb-6">
      {TABS.map(tab => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`lane-panel-${tab.key}`}
            id={`lane-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 border ${
              isActive
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `WhatYoullSeeStrip.tsx`**

```tsx
// src/components/analyze/WhatYoullSeeStrip.tsx
import { LayoutDashboard, Shield, Mountain, BarChart3, Gauge } from 'lucide-react';

const PILLARS = [
  { key: 'overview', label: 'Overview', desc: 'Health grade and at-a-glance gaps', color: 'text-emerald-400', icon: LayoutDashboard },
  { key: 'roles',    label: 'Roles',    desc: 'Ramp, removal, draw, wipes — vs targets', color: 'text-sky-400',     icon: Shield },
  { key: 'mana',     label: 'Mana',     desc: 'Land count, fixing, color sources', color: 'text-violet-400',  icon: Mountain },
  { key: 'tempo',    label: 'Tempo',    desc: 'Curve shape and pacing fit', color: 'text-amber-400',   icon: BarChart3 },
  { key: 'bracket',  label: 'Bracket',  desc: 'Estimated power level (1-5)', color: 'text-rose-400',    icon: Gauge },
];

export function WhatYoullSeeStrip() {
  return (
    <div className="mt-8 max-w-5xl mx-auto">
      <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-3">What we'll show you</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {PILLARS.map(p => (
          <div
            key={p.key}
            className="rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm px-3 py-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
              <span className="text-sm font-semibold">{p.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-snug">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab control + strip into `AnalyzePage`**

Replace the contents of `src/pages/AnalyzePage.tsx`:

```tsx
// src/pages/AnalyzePage.tsx
import { useState, useEffect } from 'react';
import { LaneTabs, type LaneKey } from '@/components/analyze/LaneTabs';
import { WhatYoullSeeStrip } from '@/components/analyze/WhatYoullSeeStrip';

const LANE_STORAGE_KEY = 'analyze-active-lane';

export function AnalyzePage() {
  const [activeLane, setActiveLane] = useState<LaneKey>(() => {
    const stored = localStorage.getItem(LANE_STORAGE_KEY);
    if (stored === 'paste' || stored === 'lists' || stored === 'generate') return stored;
    return 'paste';
  });

  useEffect(() => {
    localStorage.setItem(LANE_STORAGE_KEY, activeLane);
  }, [activeLane]);

  return (
    <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8">
      <div className="text-center py-6 max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-4xl font-bold mb-3">
          Analyze any{' '}
          <span className="gradient-text">Commander deck</span>
        </h2>
        <p className="text-base text-muted-foreground">
          See what's strong, what's missing, and why.
        </p>
      </div>

      <LaneTabs active={activeLane} onChange={setActiveLane} />

      <div
        id={`lane-panel-${activeLane}`}
        role="tabpanel"
        aria-labelledby={`lane-tab-${activeLane}`}
        className="max-w-3xl mx-auto rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-6 min-h-[280px]"
      >
        <p className="text-sm text-muted-foreground text-center py-10">
          {activeLane === 'paste' && 'Paste lane (coming in Task 3)'}
          {activeLane === 'lists' && 'My Lists lane (coming in Task 4)'}
          {activeLane === 'generate' && 'Generate lane (coming in Task 5)'}
        </p>
      </div>

      <WhatYoullSeeStrip />
    </main>
  );
}
```

- [ ] **Step 4: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Three pill tabs render: Paste · My Lists · Generate.
- Active tab persists across refresh (via `localStorage`).
- Clicking a tab swaps the placeholder content.
- The 5-pillar strip renders below.

- [ ] **Step 5: Commit**

```bash
git add src/components/analyze/LaneTabs.tsx src/components/analyze/WhatYoullSeeStrip.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): pill-tab lane control and pillar strip"
```

---

## Task 3: Create the hydration helper

This task isolates the deck-hydration logic shared by the paste and lists lanes. Both produce a synthetic `GeneratedDeck` that can be set into the Zustand store so the analyzer can consume it.

**Files:**
- Create: `src/components/analyze/analyzeHydration.ts`

- [ ] **Step 1: Create `analyzeHydration.ts`**

```tsx
// src/components/analyze/analyzeHydration.ts
//
// Builds a synthetic GeneratedDeck from a raw list of card names + commander.
// Mirrors the pattern used in ListDeckView's `buildAndSetDeck`.

import { getCardsByNames, getFrontFaceTypeLine } from '@/services/scryfall/client';
import { enrichDeckCards } from '@/services/deckBuilder/deckEnricher';
import { fetchCommanderCombos } from '@/services/edhrec/client';
import type { GeneratedDeck, DeckStats, DetectedCombo, ScryfallCard } from '@/types';

// Combo detection helper — inlined here (and duplicated in ListDeckView.tsx today).
// Extracting it to a shared module is out of scope for this feature; the function
// is small and self-contained.
function detectCombosInDeck(
  combos: { comboId: string; cards: { name: string; id: string }[]; results: string[]; deckCount: number; bracket: string }[],
  allCardNames: Set<string>,
  commanderCard: ScryfallCard | null,
  partnerCard: ScryfallCard | null,
): DetectedCombo[] | undefined {
  if (combos.length === 0) return undefined;

  const detected = combos
    .map(combo => {
      const comboCardNames = combo.cards.map(c => c.name);
      const missingCards = comboCardNames.filter(name => !allCardNames.has(name));
      return {
        comboId: combo.comboId,
        cards: comboCardNames,
        results: combo.results,
        isComplete: missingCards.length === 0,
        missingCards,
        deckCount: combo.deckCount,
        bracket: combo.bracket,
      };
    })
    .filter(dc => dc.isComplete || dc.missingCards.length <= 2);

  const commanderNames = new Set<string>();
  if (commanderCard) {
    commanderNames.add(commanderCard.name);
    if (commanderCard.name.includes(' // ')) commanderNames.add(commanderCard.name.split(' // ')[0]);
  }
  if (partnerCard) {
    commanderNames.add(partnerCard.name);
    if (partnerCard.name.includes(' // ')) commanderNames.add(partnerCard.name.split(' // ')[0]);
  }

  detected.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    const aHasCommander = a.cards.some(n => commanderNames.has(n));
    const bHasCommander = b.cards.some(n => commanderNames.has(n));
    if (aHasCommander !== bHasCommander) return aHasCommander ? -1 : 1;
    return b.deckCount - a.deckCount;
  });

  return detected.length > 0 ? detected : undefined;
}

export interface HydrateDeckInput {
  cardNames: string[];          // ALL cards including commander(s)
  commanderName?: string;
  partnerCommanderName?: string;
  deckSize?: number;            // optional override (defaults to cardNames.length)
}

export interface HydrateDeckResult {
  deck: GeneratedDeck;
  colorIdentity: string[];
}

function computeStatsFromCards(allCards: ScryfallCard[]): DeckStats {
  const nonLandCards = allCards.filter(
    card => !getFrontFaceTypeLine(card).toLowerCase().includes('land'),
  );

  const manaCurve: Record<number, number> = {};
  nonLandCards.forEach(card => {
    const cmc = Math.min(Math.floor(card.cmc), 7);
    manaCurve[cmc] = (manaCurve[cmc] || 0) + 1;
  });

  const totalCmc = nonLandCards.reduce((sum, card) => sum + card.cmc, 0);
  const averageCmc = nonLandCards.length > 0 ? totalCmc / nonLandCards.length : 0;

  const colorDistribution: Record<string, number> = {};
  allCards.forEach(card => {
    const colors = card.colors || [];
    if (colors.length === 0) {
      colorDistribution['C'] = (colorDistribution['C'] || 0) + 1;
    } else {
      colors.forEach(color => {
        colorDistribution[color] = (colorDistribution[color] || 0) + 1;
      });
    }
  });

  const typeDistribution: Record<string, number> = { Planeswalker: 0 };
  allCards.forEach(card => {
    const typeLine = getFrontFaceTypeLine(card).toLowerCase();
    if (typeLine.includes('land')) typeDistribution['Land'] = (typeDistribution['Land'] || 0) + 1;
    else if (typeLine.includes('creature')) typeDistribution['Creature'] = (typeDistribution['Creature'] || 0) + 1;
    else if (typeLine.includes('instant')) typeDistribution['Instant'] = (typeDistribution['Instant'] || 0) + 1;
    else if (typeLine.includes('sorcery')) typeDistribution['Sorcery'] = (typeDistribution['Sorcery'] || 0) + 1;
    else if (typeLine.includes('artifact')) typeDistribution['Artifact'] = (typeDistribution['Artifact'] || 0) + 1;
    else if (typeLine.includes('enchantment')) typeDistribution['Enchantment'] = (typeDistribution['Enchantment'] || 0) + 1;
    else if (typeLine.includes('planeswalker')) typeDistribution['Planeswalker'] = (typeDistribution['Planeswalker'] || 0) + 1;
    else if (typeLine.includes('battle')) typeDistribution['Battle'] = (typeDistribution['Battle'] || 0) + 1;
  });

  return {
    totalCards: allCards.length,
    averageCmc: Math.round(averageCmc * 100) / 100,
    manaCurve,
    colorDistribution,
    typeDistribution,
  };
}

export async function hydrateDeckForAnalysis(input: HydrateDeckInput): Promise<HydrateDeckResult> {
  const { cardNames, commanderName, partnerCommanderName } = input;
  const cardMap = await getCardsByNames(cardNames);
  const cards: ScryfallCard[] = [];
  for (const name of cardNames) {
    const c = cardMap.get(name);
    if (c) cards.push(c);
  }

  const commanderCard: ScryfallCard | null = commanderName ? cardMap.get(commanderName) ?? null : null;
  const partnerCard: ScryfallCard | null = partnerCommanderName ? cardMap.get(partnerCommanderName) ?? null : null;

  const commanderNames = new Set<string>();
  if (commanderCard) commanderNames.add(commanderCard.name);
  if (partnerCard) commanderNames.add(partnerCard.name);

  const deckCards = commanderNames.size > 0
    ? cards.filter(c => !commanderNames.has(c.name))
    : cards;

  const stats = computeStatsFromCards(deckCards);

  const allDeckNames = new Set<string>();
  if (commanderCard) {
    allDeckNames.add(commanderCard.name);
    if (commanderCard.name.includes(' // ')) allDeckNames.add(commanderCard.name.split(' // ')[0]);
  }
  if (partnerCard) {
    allDeckNames.add(partnerCard.name);
    if (partnerCard.name.includes(' // ')) allDeckNames.add(partnerCard.name.split(' // ')[0]);
  }
  for (const c of deckCards) {
    allDeckNames.add(c.name);
    if (c.name.includes(' // ')) allDeckNames.add(c.name.split(' // ')[0]);
  }

  let detectedCombos: DetectedCombo[] | undefined;
  if (commanderCard) {
    try {
      const combos = await fetchCommanderCombos(commanderCard.name);
      detectedCombos = detectCombosInDeck(combos, allDeckNames, commanderCard, partnerCard);
    } catch {
      // Combo fetch failed — not critical
    }
  }

  const enrichResult = await enrichDeckCards(
    deckCards,
    input.deckSize ?? cardNames.length,
    detectedCombos,
    commanderCard?.name,
    partnerCard?.name,
  );

  const deck: GeneratedDeck = {
    commander: commanderCard,
    partnerCommander: partnerCard,
    categories: enrichResult.categories,
    stats,
    detectedCombos,
    roleCounts: enrichResult.roleCounts,
    roleTargets: enrichResult.roleTargets,
    rampSubtypeCounts: enrichResult.rampSubtypeCounts,
    removalSubtypeCounts: enrichResult.removalSubtypeCounts,
    boardwipeSubtypeCounts: enrichResult.boardwipeSubtypeCounts,
    cardDrawSubtypeCounts: enrichResult.cardDrawSubtypeCounts,
    bracketEstimation: enrichResult.bracketEstimation,
    gameChangerNames: enrichResult.gameChangerNames,
    cardInclusionMap: enrichResult.cardInclusionMap,
    cardRelevancyMap: enrichResult.cardRelevancyMap,
    deckScore: enrichResult.deckScore,
  };

  const allColors = new Set<string>();
  for (const card of cards) {
    for (const c of card.color_identity || []) allColors.add(c);
  }
  const colorIdentity = ['W', 'U', 'B', 'R', 'G'].filter(c => allColors.has(c));

  return { deck, colorIdentity };
}
```

- [ ] **Step 2: Sanity-check imports compile against current code**

Open `src/services/deckBuilder/deckEnricher.ts` briefly with Read and confirm:
- `enrichDeckCards` is the exported name.
- Its signature matches the call above: `(deckCards, deckSize, detectedCombos?, commanderName?, partnerName?)`.
- The returned object contains: `categories`, `roleCounts`, `roleTargets`, `rampSubtypeCounts`, `removalSubtypeCounts`, `boardwipeSubtypeCounts`, `cardDrawSubtypeCounts`, `bracketEstimation`, `gameChangerNames`, `cardInclusionMap`, `cardRelevancyMap`, `deckScore`.

If a signature differs, adjust the call in `analyzeHydration.ts` before moving on. (The same call is made today in `ListDeckView.tsx` ~line 649 — use that as the canonical reference.)

- [ ] **Step 3: Lint+build (no smoke yet — not wired in)**

```bash
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/analyze/analyzeHydration.ts
git commit -m "feat(analyze): deck hydration helper for paste/list lanes"
```

---

## Task 4: Paste lane

**Files:**
- Create: `src/components/analyze/PasteLane.tsx`
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Create `PasteLane.tsx`**

```tsx
// src/components/analyze/PasteLane.tsx
import { useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollectionImporter } from '@/components/collection/CollectionImporter';
import { searchCommanders } from '@/services/scryfall/client';
import type { ScryfallCard } from '@/types';

export interface PasteLaneResult {
  cardNames: string[];
  commanderName: string;
  partnerCommanderName?: string;
}

interface PasteLaneProps {
  onAnalyze: (result: PasteLaneResult) => void;
  loading: boolean;
}

export function PasteLane({ onAnalyze, loading }: PasteLaneProps) {
  const [importedCards, setImportedCards] = useState<string[]>([]);
  const [legendaries, setLegendaries] = useState<ScryfallCard[]>([]);
  const [commanderCard, setCommanderCard] = useState<ScryfallCard | null>(null);
  const [fallbackQuery, setFallbackQuery] = useState('');
  const [fallbackResults, setFallbackResults] = useState<ScryfallCard[]>([]);
  const [fallbackSearching, setFallbackSearching] = useState(false);

  // The CollectionImporter fires onLegendariesDetected FIRST, then auto-fires
  // onCommanderDetected with the first legendary. If multiple legendaries were
  // detected (and no `*CMDR*` marker was present) we want the user to pick
  // explicitly — so we use a ref to know about multi-legendary state at the
  // moment onCommanderDetected runs.
  const legendariesRef = useRef<ScryfallCard[]>([]);

  const handleImportCards = useCallback((validatedNames: string[]) => {
    setImportedCards(validatedNames);
    return { added: validatedNames.length, updated: 0 };
  }, []);

  const handleCommanderDetected = useCallback((card: ScryfallCard) => {
    // Suppress the importer's auto-pick when multiple legendaries are present.
    // The *CMDR* marker path still works because the marker fires onCommanderDetected
    // BEFORE legendaries are scanned (so legendariesRef is still empty here).
    if (legendariesRef.current.length > 1) return;
    setCommanderCard(card);
  }, []);

  const handleLegendariesDetected = useCallback((found: ScryfallCard[]) => {
    legendariesRef.current = found;
    setLegendaries(found);
  }, []);

  // Fallback Scryfall commander search (used when no legendaries detected)
  const runFallbackSearch = useCallback(async (q: string) => {
    setFallbackQuery(q);
    if (q.trim().length < 2) { setFallbackResults([]); return; }
    setFallbackSearching(true);
    try {
      const results = await searchCommanders(q.trim());
      setFallbackResults(results.slice(0, 8));
    } finally {
      setFallbackSearching(false);
    }
  }, []);

  const showLegendaryPicker = legendaries.length > 1 && !commanderCard;
  const showFallback = importedCards.length > 0 && legendaries.length === 0 && !commanderCard;
  const canAnalyze = importedCards.length > 0 && commanderCard !== null && !loading;

  return (
    <div className="space-y-4">
      <CollectionImporter
        label=""
        textareaClassName="min-h-[180px]"
        onImportCards={handleImportCards}
        onCommanderDetected={handleCommanderDetected}
        onLegendariesDetected={handleLegendariesDetected}
      />

      {showLegendaryPicker && (
        <div className="rounded-lg border border-border/40 bg-card/30 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Multiple legendary creatures detected — pick the commander:
          </p>
          <div className="flex flex-wrap gap-2">
            {legendaries.map(card => (
              <button
                key={card.name}
                onClick={() => setCommanderCard(card)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-border/50 hover:bg-accent hover:border-primary/50 transition-colors"
              >
                {card.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFallback && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-amber-400/90">
            We couldn't find a commander in this list — pick one to analyze.
          </p>
          <input
            type="text"
            value={fallbackQuery}
            onChange={(e) => runFallbackSearch(e.target.value)}
            placeholder="Search for a commander…"
            className="w-full bg-card/50 border border-border/50 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {fallbackSearching && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Searching…
            </p>
          )}
          {fallbackResults.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fallbackResults.map(c => (
                <button
                  key={c.name}
                  onClick={() => setCommanderCard(c)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-border/50 hover:bg-accent hover:border-primary/50 transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {commanderCard && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400/90">
          Commander: <span className="font-semibold text-emerald-300">{commanderCard.name}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (!commanderCard) return;
            // Build full card list: ensure commander name is in there exactly once.
            const names = importedCards.includes(commanderCard.name)
              ? importedCards
              : [commanderCard.name, ...importedCards];
            onAnalyze({ cardNames: names, commanderName: commanderCard.name });
          }}
          disabled={!canAnalyze}
          className="btn-shimmer"
          title={!commanderCard ? 'Pick a commander to analyze this list' : 'Analyze this deck'}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>Analyze →</>
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Confirm `searchCommanders` exists in `scryfall/client.ts`**

Open `src/services/scryfall/client.ts` and verify `searchCommanders` is exported (already used in `ListCreateEditForm.tsx`). If the name differs, update the import line in `PasteLane.tsx` to match.

- [ ] **Step 3: Wire the paste lane into `AnalyzePage`**

In `src/pages/AnalyzePage.tsx`, add imports:

```tsx
import { useStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { PasteLane, type PasteLaneResult } from '@/components/analyze/PasteLane';
import { hydrateDeckForAnalysis } from '@/components/analyze/analyzeHydration';
```

Add state + handler inside the component (above the return):

```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handlePasteAnalyze = useCallback(async (result: PasteLaneResult) => {
  setLoading(true);
  setError(null);
  try {
    const { deck, colorIdentity } = await hydrateDeckForAnalysis({
      cardNames: result.cardNames,
      commanderName: result.commanderName,
      partnerCommanderName: result.partnerCommanderName,
    });
    useStore.setState({
      commander: deck.commander,
      partnerCommander: deck.partnerCommander,
      colorIdentity,
      generatedDeck: deck,
    });
  } catch (e) {
    console.error('[AnalyzePage] paste hydration failed', e);
    setError('Could not analyze this deck. Check the card names and try again.');
  } finally {
    setLoading(false);
  }
}, []);
```

Add `useCallback` to the existing `useState`, `useEffect` import line.

Replace the paste placeholder in the tabpanel with:

```tsx
{activeLane === 'paste' && (
  <PasteLane onAnalyze={handlePasteAnalyze} loading={loading} />
)}
```

Render an error banner above the tabpanel if `error` is set:

```tsx
{error && (
  <div className="max-w-3xl mx-auto mb-3 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-400">
    {error}
  </div>
)}
```

- [ ] **Step 4: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Paste lane shows a textarea (the existing `CollectionImporter`).
- Paste a Moxfield-style decklist with `*CMDR*` marker → commander auto-resolves and the green "Commander:" pill appears.
- Paste a list without a `*CMDR*` but containing exactly one legendary → it auto-resolves.
- Paste a list with multiple legendaries → the picker appears, click one to resolve.
- Paste a list with no legendaries → the fallback Scryfall search appears.
- "Analyze →" stays disabled until a commander is resolved.
- Clicking "Analyze →" with a resolved commander shows the spinner, then the Zustand `generatedDeck` is populated (verify via React DevTools or `useStore.getState()` in the console). The page does not yet render the loaded state — that's Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/components/analyze/PasteLane.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): paste lane with commander resolution"
```

---

## Task 5: My Lists lane

**Files:**
- Create: `src/components/analyze/ListsLane.tsx`
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Create `ListsLane.tsx`**

```tsx
// src/components/analyze/ListsLane.tsx
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useUserLists } from '@/hooks/useUserLists';
import { ColorIdentity } from '@/components/ui/mtg-icons';
import type { UserCardList } from '@/types';

interface ListsLaneProps {
  onPick: (list: UserCardList) => void;
  loading: boolean;
  loadingListId: string | null;
}

export function ListsLane({ onPick, loading, loadingListId }: ListsLaneProps) {
  const { lists } = useUserLists();
  const eligible = useMemo(
    () => lists.filter(l => !!l.commanderName).sort((a, b) => b.updatedAt - a.updatedAt),
    [lists],
  );

  if (eligible.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No saved lists yet. Paste a deck above, or build one and come back.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {eligible.map(list => {
        const isLoading = loading && loadingListId === list.id;
        return (
          <button
            key={list.id}
            onClick={() => onPick(list)}
            disabled={loading}
            className={`flex items-center gap-3 text-left rounded-lg border border-border/50 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors p-2.5 ${
              loading && !isLoading ? 'opacity-50' : ''
            }`}
          >
            <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted/30">
              {list.cachedCommanderArtUrl ? (
                <img
                  src={list.cachedCommanderArtUrl}
                  alt={list.commanderName}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{list.name}</p>
              <p className="text-xs text-muted-foreground truncate">{list.commanderName}</p>
              {list.cachedColorIdentity && list.cachedColorIdentity.length > 0 && (
                <div className="mt-1">
                  <ColorIdentity colors={list.cachedColorIdentity} size="sm" />
                </div>
              )}
            </div>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `AnalyzePage`**

In `src/pages/AnalyzePage.tsx`, add the import:

```tsx
import { ListsLane } from '@/components/analyze/ListsLane';
import type { UserCardList } from '@/types';
```

Add state + handler:

```tsx
const [loadingListId, setLoadingListId] = useState<string | null>(null);

const handleListPick = useCallback(async (list: UserCardList) => {
  setLoading(true);
  setLoadingListId(list.id);
  setError(null);
  try {
    const { deck, colorIdentity } = await hydrateDeckForAnalysis({
      cardNames: list.cards,
      commanderName: list.commanderName,
      partnerCommanderName: list.partnerCommanderName,
      deckSize: list.deckSize ?? list.cards.length,
    });
    useStore.setState({
      commander: deck.commander,
      partnerCommander: deck.partnerCommander,
      colorIdentity,
      generatedDeck: deck,
    });
  } catch (e) {
    console.error('[AnalyzePage] list hydration failed', e);
    setError('Could not analyze this list. Please try again.');
  } finally {
    setLoading(false);
    setLoadingListId(null);
  }
}, []);
```

Replace the lists placeholder in the tabpanel:

```tsx
{activeLane === 'lists' && (
  <ListsLane onPick={handleListPick} loading={loading} loadingListId={loadingListId} />
)}
```

- [ ] **Step 3: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Switch to the My Lists tab.
- With no saved lists, the empty-state message renders.
- With at least one list that has a commander, the grid renders with art, name, and commander.
- Click a list — spinner shows on that card, then the Zustand `generatedDeck` is populated.
- Lists without a commander are filtered out.

- [ ] **Step 4: Commit**

```bash
git add src/components/analyze/ListsLane.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): my lists lane with one-click hydration"
```

---

## Task 6: Generate lane

**Files:**
- Create: `src/components/analyze/GenerateLane.tsx`
- Modify: `src/pages/AnalyzePage.tsx`

- [ ] **Step 1: Create `GenerateLane.tsx`**

```tsx
// src/components/analyze/GenerateLane.tsx
import { useState, useCallback } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchCommanders } from '@/services/scryfall/client';
import { useNavigate } from 'react-router-dom';
import type { ScryfallCard } from '@/types';

export function GenerateLane() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<ScryfallCard | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    setPicked(null);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await searchCommanders(q.trim());
      setResults(r.slice(0, 8));
    } finally {
      setSearching(false);
    }
  }, []);

  const handleGenerate = useCallback(() => {
    if (!picked) return;
    // The Generate flow lives on /build/:commanderName. After generation,
    // the post-gen "Analyze this deck" CTA brings the user back to /analyze.
    navigate(`/build/${encodeURIComponent(picked.name)}`);
  }, [navigate, picked]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Pick a commander — we'll build a deck on the Generate page, then bring you back here to analyze it.
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        placeholder="Search for a commander…"
        className="w-full bg-card/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
      />

      {searching && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Searching…
        </p>
      )}

      {results.length > 0 && !picked && (
        <div className="flex flex-wrap gap-2">
          {results.map(c => (
            <button
              key={c.name}
              onClick={() => { setPicked(c); setResults([]); }}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border/50 hover:bg-accent hover:border-primary/50 transition-colors"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm flex items-center justify-between">
          <span>Commander: <span className="font-semibold">{picked.name}</span></span>
          <button
            onClick={() => { setPicked(null); setQuery(''); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleGenerate}
          disabled={!picked}
          className="btn-shimmer"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate & Analyze
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `AnalyzePage`**

Add import:

```tsx
import { GenerateLane } from '@/components/analyze/GenerateLane';
```

Replace the generate placeholder:

```tsx
{activeLane === 'generate' && <GenerateLane />}
```

- [ ] **Step 3: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Switch to the Generate tab.
- Type a commander name → autocomplete results appear.
- Click a result → confirmation pill shows; "Generate & Analyze" enables.
- Click the button → routes to `/build/<commanderName>` (existing BuilderPage flow).
- The Builder page should render normally with the chosen commander pre-selected (per existing BuilderPage URL-param behavior).

- [ ] **Step 4: Commit**

```bash
git add src/components/analyze/GenerateLane.tsx src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): generate lane routes to /build"
```

---

## Task 7: Deck-loaded state — CommanderStrip + full-width analyzer

**Files:**
- Create: `src/components/analyze/CommanderStrip.tsx`
- Modify: `src/pages/AnalyzePage.tsx`
- Modify: `src/App.tsx` (re-enable commander background art on `/analyze` once a deck is loaded)

- [ ] **Step 1: Create `CommanderStrip.tsx`**

```tsx
// src/components/analyze/CommanderStrip.tsx
import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Bookmark, Check, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorIdentity } from '@/components/ui/mtg-icons';
import { useUserLists } from '@/hooks/useUserLists';
import { trackEvent } from '@/services/analytics';
import { getCardImageUrl } from '@/services/scryfall/client';
import type { GeneratedDeck, UserCardList } from '@/types';

export type AnalyzeSource =
  | { kind: 'paste' }
  | { kind: 'list'; listId: string; listName: string }
  | { kind: 'generated' };

interface CommanderStripProps {
  deck: GeneratedDeck;
  colorIdentity: string[];
  source: AnalyzeSource;
  onChangeDeck: () => void;
  onSavedAsList?: (newList: UserCardList) => void;
}

function getCommanderArtUrl(deck: GeneratedDeck): string | null {
  const c = deck.commander;
  if (!c) return null;
  return c.image_uris?.art_crop
    ?? c.card_faces?.[0]?.image_uris?.art_crop
    ?? getCardImageUrl(c, 'normal');
}

export function CommanderStrip({ deck, colorIdentity, source, onChangeDeck, onSavedAsList }: CommanderStripProps) {
  const { createList } = useUserLists();
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedListId, setSavedListId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cardCount = (() => {
    let n = deck.commander ? 1 : 0;
    if (deck.partnerCommander) n += 1;
    for (const cards of Object.values(deck.categories)) n += cards.length;
    return n;
  })();

  const handleSaveOpen = useCallback(() => {
    if (savedListId) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const defaultName = source.kind === 'generated'
      ? `${deck.commander?.name ?? 'Untitled'} — Analyzed ${today}`
      : '';
    setSaveName(defaultName);
    setShowSaveInput(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [source.kind, deck.commander, savedListId]);

  const handleSaveCommit = useCallback(() => {
    const name = saveName.trim();
    if (!name) return;
    const cardNames: string[] = [];
    if (deck.commander) cardNames.push(deck.commander.name);
    if (deck.partnerCommander) cardNames.push(deck.partnerCommander.name);
    for (const cards of Object.values(deck.categories)) {
      for (const c of cards) cardNames.push(c.name);
    }
    const newList = createList(name, cardNames, '', {
      type: 'deck',
      commanderName: deck.commander?.name,
      partnerCommanderName: deck.partnerCommander?.name,
      deckSize: cardNames.length,
    });
    setSavedListId(newList.id);
    setShowSaveInput(false);
    trackEvent('analyze_deck_saved', { listName: name, cardCount: cardNames.length, source: source.kind });
    onSavedAsList?.(newList);
  }, [saveName, deck, createList, source.kind, onSavedAsList]);

  const sourceLabel = (() => {
    if (savedListId) return `From "${saveName}"`;
    if (source.kind === 'paste') return 'Pasted';
    if (source.kind === 'generated') return 'Generated';
    return `From "${source.listName}"`;
  })();
  const showSaveButton = (source.kind === 'paste' || source.kind === 'generated') && !savedListId;

  const artUrl = getCommanderArtUrl(deck);

  return (
    <div className="container mx-auto px-4 mb-4">
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm flex items-center gap-3 p-2.5">
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted/30">
          {artUrl && <img src={artUrl} alt={deck.commander?.name ?? ''} className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{deck.commander?.name ?? 'No commander'}</p>
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              {sourceLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ColorIdentity colors={colorIdentity} size="sm" />
            <span className="text-xs text-muted-foreground">{cardCount} cards</span>
          </div>
          <button
            onClick={onChangeDeck}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Analyze a different deck
          </button>
        </div>
        <div className="flex items-center gap-2">
          {source.kind === 'list' && !savedListId && (
            <a
              href={`#/lists/${source.listId}/deck-view`}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Open original list"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {showSaveButton && !showSaveInput && (
            <Button size="sm" variant="outline" onClick={handleSaveOpen}>
              <Bookmark className="w-3.5 h-3.5 mr-1.5" />
              Save to My Lists
            </Button>
          )}
          {savedListId && (
            <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {showSaveInput && (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => { e.preventDefault(); handleSaveCommit(); }}
            >
              <input
                ref={inputRef}
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="List name"
                className="bg-card/50 border border-border/50 rounded-md px-2.5 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary/50"
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowSaveInput(false); setSaveName(''); } }}
              />
              <button
                type="submit"
                disabled={!saveName.trim()}
                className="p-1 rounded-md text-emerald-400 hover:bg-accent disabled:opacity-50"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-accent"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the analyzer in the loaded state on `AnalyzePage`**

Add imports to `AnalyzePage.tsx`:

```tsx
import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { DeckOptimizer } from '@/components/deck/optimizer';
import { CommanderStrip, type AnalyzeSource } from '@/components/analyze/CommanderStrip';
import { useUserLists } from '@/hooks/useUserLists';
import { resetTheme, applyCommanderTheme } from '@/lib/commanderTheme';
```

Add to component body (with the existing state):

```tsx
const generatedDeck = useStore(s => s.generatedDeck);
const colorIdentityStore = useStore(s => s.colorIdentity);
const { lists } = useUserLists();
const [searchParams] = useSearchParams();
const listIdParam = searchParams.get('listId');

// Track where the current deck came from for the source pill.
const [source, setSource] = useState<AnalyzeSource | null>(null);

// Hydrate from `?listId=<id>` (bridge from ListDeckView) on mount.
const hydratedListIdRef = useRef<string | null>(null);
useEffect(() => {
  if (!listIdParam || hydratedListIdRef.current === listIdParam) return;
  const list = lists.find(l => l.id === listIdParam);
  if (!list || !list.commanderName) return;
  hydratedListIdRef.current = listIdParam;
  setLoading(true);
  setError(null);
  hydrateDeckForAnalysis({
    cardNames: list.cards,
    commanderName: list.commanderName,
    partnerCommanderName: list.partnerCommanderName,
    deckSize: list.deckSize ?? list.cards.length,
  })
    .then(({ deck, colorIdentity }) => {
      useStore.setState({
        commander: deck.commander,
        partnerCommander: deck.partnerCommander,
        colorIdentity,
        generatedDeck: deck,
      });
      setSource({ kind: 'list', listId: list.id, listName: list.name });
    })
    .catch(e => {
      console.error('[AnalyzePage] listId hydration failed', e);
      setError('Could not load this list. Please try again.');
    })
    .finally(() => setLoading(false));
}, [listIdParam, lists]);
```

Update the paste / list-pick handlers to set `source` when they succeed:

In `handlePasteAnalyze`, after the `useStore.setState(...)` call, add:

```tsx
setSource({ kind: 'paste' });
```

In `handleListPick`, after the `useStore.setState(...)` call:

```tsx
setSource({ kind: 'list', listId: list.id, listName: list.name });
```

Detect bridge-from-Generate: if `generatedDeck` is already in the store on mount AND no `listId` param AND no `source` set yet, treat it as `kind: 'generated'`:

```tsx
useEffect(() => {
  if (source !== null) return;
  if (generatedDeck && !listIdParam) {
    setSource({ kind: 'generated' });
  }
}, [generatedDeck, listIdParam, source]);
```

Apply commander theme when a deck is loaded:

```tsx
useEffect(() => {
  if (colorIdentityStore.length > 0) {
    applyCommanderTheme(colorIdentityStore);
  }
  return () => resetTheme();
}, [colorIdentityStore]);
```

Restructure the return to render the loaded state when a deck is set:

```tsx
const handleChangeDeck = useCallback(() => {
  if (source?.kind === 'paste') {
    const ok = window.confirm("Discard this analysis? You haven't saved it.");
    if (!ok) return;
  }
  useStore.setState({ generatedDeck: null, commander: null, partnerCommander: null, colorIdentity: [] });
  setSource(null);
  setError(null);
  hydratedListIdRef.current = null;
}, [source]);

const deckLoaded = generatedDeck && source;

if (deckLoaded) {
  return (
    <main className="flex-1 py-6">
      <CommanderStrip
        deck={generatedDeck}
        colorIdentity={colorIdentityStore}
        source={source}
        onChangeDeck={handleChangeDeck}
        onSavedAsList={() => { /* source pill updates automatically via internal state */ }}
      />
      <div className="px-4 sm:px-8 lg:px-12">
        {generatedDeck.commander && (
          <DeckOptimizer
            commanderName={generatedDeck.commander.name}
            partnerCommanderName={generatedDeck.partnerCommander?.name}
            currentCards={Object.values(generatedDeck.categories).flat()}
            deckSize={(() => {
              const partner = generatedDeck.partnerCommander ? 1 : 0;
              const total = (generatedDeck.commander ? 1 : 0) + partner + Object.values(generatedDeck.categories).reduce((n, arr) => n + arr.length, 0);
              return Math.max(total - 1 - partner, 0);
            })()}
            roleCounts={generatedDeck.roleCounts || {}}
            roleTargets={generatedDeck.roleTargets || {}}
            categories={generatedDeck.categories}
            cardInclusionMap={generatedDeck.cardInclusionMap}
          />
        )}
      </div>
    </main>
  );
}
```

(The existing empty-hub `<main>` block stays as the fallback when no deck is loaded.)

- [ ] **Step 3: Re-enable commander background on `/analyze` when a deck is loaded**

In `App.tsx`, locate the line added in Task 1:

```tsx
const isAnalyzePage = location.pathname.startsWith('/analyze');
```

Change the background guard:

```tsx
{!isCollectionPage && (!isAnalyzePage || !!generatedDeck) && (
  <CommanderBackground commander={commander} deckGenerated={!!generatedDeck} />
)}
```

(I.e., on `/analyze` the background appears only when a deck is loaded.)

- [ ] **Step 4: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Empty hub: pill tabs, lanes, pillar strip. No background art.
- Paste a deck → click Analyze → loaded state renders: commander strip on top (`Pasted` pill), commander art fades in as background, full-width analyzer below. Analyzer auto-runs and tabs (Overview / Roles / Mana / Tempo / Bracket) appear.
- Click "Analyze a different deck" → confirms "Discard this analysis?", returns to empty hub on confirm.
- Pick a saved list from My Lists → loaded state renders with `From "<name>"` pill.
- Click "Analyze a different deck" → returns to hub immediately (no confirm — already saved).
- Visit `/analyze?listId=<existing-list-id>` directly → list hydrates and loaded state renders.
- Pasted deck save button: click → name field appears → type a name → Check → pill swaps to `From "<name>"`, button replaced with "Saved" pill.

- [ ] **Step 5: Commit**

```bash
git add src/components/analyze/CommanderStrip.tsx src/pages/AnalyzePage.tsx src/App.tsx
git commit -m "feat(analyze): loaded state with commander strip and full-width analyzer"
```

---

## Task 8: Retire inline analyzer on BuilderPage; add Analyze CTA

**Files:**
- Modify: `src/pages/BuilderPage.tsx`

- [ ] **Step 1: Remove the inline `<DeckOptimizer>` mount and its import**

In `src/pages/BuilderPage.tsx`, remove the block at ~lines 1171-1184:

```tsx
{eaEnabled && commander && generatedDeck && (
  <DeckOptimizer
    commanderName={commander.name}
    partnerCommanderName={partnerCommander?.name}
    currentCards={Object.values(generatedDeck.categories).flat()}
    deckSize={customization.deckFormat === 99 ? (100 - (partnerCommander ? 2 : 1)) : (customization.deckFormat - (partnerCommander ? 2 : 1))}
    roleCounts={generatedDeck.roleCounts || {}}
    roleTargets={generatedDeck.roleTargets || {}}
    categories={generatedDeck.categories}
    cardInclusionMap={generatedDeck.cardInclusionMap}
    onAddCards={(names, _dest) => handleAddCards(names)}
    onRemoveCards={handleRemoveCards}
  />
)}
```

Remove the import:

```tsx
import { DeckOptimizer } from '@/components/deck/optimizer';
```

If `eaEnabled` is no longer used anywhere else in the file after this removal, also remove its declaration and the listener that sets it (search for `eaEnabled` and `ea-features-changed` in the file). If it IS still used (e.g. for other EA features), leave it.

- [ ] **Step 2: Add the "Analyze this deck" CTA in the sidebar header**

Add `Microscope` to the Lucide imports (search for the existing `lucide-react` import line in `BuilderPage.tsx`):

```tsx
import { ..., Microscope } from 'lucide-react';
```

In the `sidebarHeader` block (the flex row with the Save Popover + Export button, ≈ line 1058):

```tsx
sidebarHeader={
  <div className="flex items-center justify-end gap-2">
    <Popover open={showSaveInput && !savedToList} ...>
      ...
    </Popover>
    <Button onClick={() => exportTriggerRef.current?.()} className="btn-shimmer">
      <Copy className="w-4 h-4 mr-2" />
      Export
    </Button>
  </div>
}
```

Insert a new Analyze button between Save and Export:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    trackEvent('analyze_cta_clicked', { from: 'builder' });
    navigate('/analyze');
  }}
  title="Open in the Analyze page"
>
  <Microscope className="w-4 h-4 mr-1.5" />
  Analyze
</Button>
```

Also add it to the `renderHeaderActions` toolbar (the mobile-visible one) so it's reachable on small viewports:

```tsx
renderHeaderActions={({ onExport }) => {
  exportTriggerRef.current = onExport;
  return (
    <div className="flex items-center gap-2 xl:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          trackEvent('analyze_cta_clicked', { from: 'builder' });
          navigate('/analyze');
        }}
      >
        <Microscope className="w-4 h-4 mr-1.5" />
        Analyze
      </Button>
      <Button onClick={onExport} className="btn-shimmer">
        <Copy className="w-4 h-4 mr-2" />
        Export
      </Button>
    </div>
  );
}}
```

(`navigate` is already in scope from `useNavigate()` near the top of the component; `trackEvent` is imported from `@/services/analytics` at the top of the file — confirm both exist before this step. If `trackEvent` is not yet imported here, add `import { trackEvent } from '@/services/analytics';`.)

- [ ] **Step 3: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Generate a deck via the normal flow. After it appears, the "Analyze" button is visible in the deck header (and in the mobile toolbar above the deck).
- Click "Analyze" → routes to `/analyze` and the loaded state renders (commander strip says `Generated`, full analyzer underneath).
- The old EA-gated inline analyzer is gone — there's nothing extra at the bottom of the generated deck on BuilderPage.

- [ ] **Step 4: Commit**

```bash
git add src/pages/BuilderPage.tsx
git commit -m "feat(builder): replace inline analyzer with /analyze CTA"
```

---

## Task 9: Retire inline analyzer on ListDeckView; add Analyze CTA

**Files:**
- Modify: `src/components/lists/ListDeckView.tsx`

- [ ] **Step 1: Remove the inline `<DeckOptimizer>` mount and its import**

In `src/components/lists/ListDeckView.tsx`, remove the block at ~lines 1429-1453:

```tsx
{eaEnabled && list.commanderName && generatedDeck && (
  <DeckOptimizer
    commanderName={list.commanderName}
    ...
    maybeboardNames={list.maybeboard}
  />
)}
```

Remove the import:

```tsx
import { DeckOptimizer } from '@/components/deck/optimizer';
```

If `eaEnabled` is only used for this block in the file, also remove its declaration. (Search for `eaEnabled` and `ea-features-changed` in the file.)

- [ ] **Step 2: Add the "Analyze this deck" button to the list-deck toolbar**

Find the existing toolbar buttons in `ListDeckView.tsx` (search for the buttons near the top — there's a row containing things like Pencil/Edit, CopyPlus/Duplicate, etc.; the exact location depends on layout). The CTA should sit alongside those primary toolbar actions, before the overflow menu (`MoreHorizontal`).

Add `Microscope` to the Lucide imports (existing line):

```tsx
import { ..., Microscope } from 'lucide-react';
```

Pick a stable spot in the toolbar (alongside the Edit / Duplicate icon buttons) and insert:

```tsx
<button
  onClick={() => {
    trackEvent('analyze_cta_clicked', { from: 'list-deck' });
    navigate(`/analyze?listId=${list.id}`);
  }}
  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
  title="Analyze this deck"
  aria-label="Analyze this deck"
>
  <Microscope className="w-4 h-4" />
</button>
```

`navigate` is already in scope via `useNavigate()` at the top of the component. `trackEvent` is in `@/services/analytics` — add the import if it's not already present.

- [ ] **Step 3: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Open a saved deck list (`/lists/<id>/deck-view`).
- The "Analyze" microscope icon is visible in the toolbar.
- Click it → routes to `/analyze?listId=<id>` and the loaded state renders (`From "<list name>"` pill).
- The old inline analyzer below the deck is gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/lists/ListDeckView.tsx
git commit -m "feat(lists): replace inline analyzer with /analyze CTA"
```

---

## Task 10: Analytics events

**Files:**
- Modify: `src/pages/AnalyzePage.tsx`
- (Already added in Task 8/9: `analyze_cta_clicked` and `analyze_deck_saved`.)

- [ ] **Step 1: Add page-view event with source attribution**

In `src/pages/AnalyzePage.tsx`, add `trackEvent` import:

```tsx
import { trackEvent } from '@/services/analytics';
```

Add an effect on mount:

```tsx
useEffect(() => {
  const generated = useStore.getState().generatedDeck;
  const src = listIdParam ? 'from_list' : (generated ? 'from_generate' : 'direct');
  trackEvent('analyze_page_viewed', { source: src });
  // We only want this once per mount, regardless of param/store changes later.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Add deck-loaded event from each lane**

In each lane-success path (paste handler, list-pick handler, list-id useEffect), after `useStore.setState({...})`, add:

```tsx
trackEvent('analyze_deck_loaded', {
  source: 'paste',   // or 'list' for handleListPick / listId effect, or 'generated' in the bridge useEffect
  cardCount: deck.commander
    ? Object.values(deck.categories).reduce((n, a) => n + a.length, 0) + 1 + (deck.partnerCommander ? 1 : 0)
    : Object.values(deck.categories).reduce((n, a) => n + a.length, 0),
  hasCommander: !!deck.commander,
});
```

In the bridge-from-generate effect (Task 7 added):

```tsx
useEffect(() => {
  if (source !== null) return;
  if (generatedDeck && !listIdParam) {
    setSource({ kind: 'generated' });
    trackEvent('analyze_deck_loaded', {
      source: 'generated',
      cardCount: generatedDeck.commander
        ? Object.values(generatedDeck.categories).reduce((n, a) => n + a.length, 0) + 1 + (generatedDeck.partnerCommander ? 1 : 0)
        : Object.values(generatedDeck.categories).reduce((n, a) => n + a.length, 0),
      hasCommander: !!generatedDeck.commander,
    });
  }
}, [generatedDeck, listIdParam, source]);
```

- [ ] **Step 3: Add lane-switch event**

In `AnalyzePage`'s `useEffect` that persists `activeLane`, change it to also fire the event. Capture the previous lane via a ref:

```tsx
const prevLaneRef = useRef<LaneKey>(activeLane);
useEffect(() => {
  localStorage.setItem(LANE_STORAGE_KEY, activeLane);
  if (prevLaneRef.current !== activeLane) {
    trackEvent('analyze_lane_switched', { from: prevLaneRef.current, to: activeLane });
    prevLaneRef.current = activeLane;
  }
}, [activeLane]);
```

- [ ] **Step 4: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Open the Network tab (or wherever `trackEvent` posts go).
- Visit `/analyze` → see `analyze_page_viewed` with `source: 'direct'`.
- Switch tabs → see `analyze_lane_switched` events.
- Paste a deck and analyze → see `analyze_deck_loaded` with `source: 'paste'`.
- Save the pasted deck → see `analyze_deck_saved`.
- Visit `/analyze?listId=<id>` directly → `analyze_page_viewed` with `source: 'from_list'`.
- Click Analyze from BuilderPage after generation → `analyze_page_viewed` with `source: 'from_generate'` and `analyze_deck_loaded` with `source: 'generated'`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AnalyzePage.tsx
git commit -m "feat(analyze): analytics events for page/lane/load/save"
```

---

## Task 11: Patch notes + version bump

**Files:**
- Modify: `src/data/patchNotes.json`
- Modify: `package.json`

- [ ] **Step 1: Bump version**

In `package.json`, change:

```json
"version": "1.2.27"
```

to:

```json
"version": "1.3.0"
```

- [ ] **Step 2: Add patch notes entry**

In `src/data/patchNotes.json`, prepend a new entry at the start of the array:

```json
{
  "version": "1.3.0",
  "notes": [
    "New Analyze page — paste a decklist, pick a saved deck, or generate a fresh one, then inspect roles, mana, curve, bracket, and combos in one place.",
    "Added Analyze to the navbar between Generate and Lists.",
    "Generated decks and saved lists both have an Analyze button that opens the full-width analyzer."
  ]
}
```

(Per the user's auto-memory rule on patch notes: do NOT remove older entries to keep this short.)

- [ ] **Step 3: Lint+build+smoke**

```bash
npm run lint
npm run build
npm run dev
```

Smoke:
- Header version number reads `v1.3.0`.
- Clicking the version opens the patch-notes popover and the new 1.3.0 entry is at the top.

- [ ] **Step 4: Commit**

```bash
git add package.json src/data/patchNotes.json
git commit -m "chore: bump to 1.3.0 with analyze page notes"
```

---

## Final acceptance walkthrough

After all 11 tasks land, run one full end-to-end pass in `npm run dev`:

1. **Empty hub** — visit `/analyze` from the navbar. Three pill tabs, last-selected lane persists, pillar strip below. No background art.
2. **Paste flow** — paste a Moxfield list with `*CMDR*` → resolves automatically → Analyze → loaded state with `Pasted` pill, art background, full-width analyzer, all 5 tabs work.
3. **Save** — click "Save to My Lists" on the pasted deck → enter a name → pill swaps to `From "<name>"` → visit `/lists` to confirm it landed.
4. **Discard guard** — paste a new deck (don't save) → click "Analyze a different deck" → confirms before discarding.
5. **My Lists lane** — visit a list (already saved) → loaded state with `From "<name>"`. No save button (already saved). External-link icon takes you to the original list view.
6. **Generate lane** — type a commander → click Generate & Analyze → lands on `/build/:commanderName` → generate the deck → click the new "Analyze" CTA in the deck header → lands on `/analyze` with `Generated` pill, save button offered.
7. **List-view bridge** — open a saved deck list → click the microscope icon in the toolbar → lands on `/analyze?listId=<id>` with `From "<name>"` pill.
8. **Retirement** — confirm the old EA-gated inline analyzer is no longer visible on either `BuilderPage` or `ListDeckView`.
9. **Mobile** — repeat the above on a narrow viewport. Navbar, lane tabs, save form, and CTAs all reachable.
10. **Patch notes** — version `1.3.0` shows in the header; clicking opens the popover with the new entry at the top.

---

## Self-Review Notes

**Spec coverage check:** every Spec section maps to a task:

| Spec section | Task(s) |
|---|---|
| Navigation & identity (navbar reorder, route, background guard) | 1 |
| Empty hub (hero, pill tabs, lanes scaffold, pillar strip) | 2 |
| Paste lane | 3 (hydration), 4 (UI) |
| My Lists lane | 3, 5 |
| Generate lane | 6 |
| Deck-loaded state (commander strip, full-width analyzer, art background) | 7 |
| Generate → Analyze bridge (BuilderPage) | 8 |
| Generate → Analyze bridge (ListDeckView) | 9 |
| EA → GA graduation | 8, 9 (inline analyzer removed; new `/analyze` is unconditional) |
| Analytics | 10 |
| Patch notes + version | 11 |

**Type consistency:** `LaneKey`, `AnalyzeSource`, `PasteLaneResult`, `HydrateDeckInput`/`HydrateDeckResult` defined once and reused. The `source.kind` discriminator in `CommanderStrip` matches the same union shape created by `AnalyzePage`.

**Out-of-scope items confirmed deferred:** shareable URLs, URL-based imports (Moxfield URL fetch), compare-two-decks, analyzer internal changes, mobile-specific analyzer redesign.
