# PBI-BRAWL-33 — Fill legal: todas las cartas legales del formatMode (no solo creatures)

**Base:** PR #6 @ `1ae716d` · Gaps limpio ADR v3 · Fuera: Scryfall page1, hydrate load, DECK_FORMAT_CONFIGS 40/60

## User story
Como builder en `brawl100`, quiero que el pool legal alimente el fill de **todas** las categorías de no-land del mazo (no solo `creatures`), respetando tipos / slots del pipeline existente.

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'brawl100'` y un pool legal con cartas de varios `primary_type` / tipos (creature, instant, sorcery, artifact, enchantment, planeswalker, etc.)  
   **When** `selectFormatFill` / merge fill usa el pool legal  
   **Then** las cartas legales **no** se vuelcan todas a `cardlists.creatures` vaciando el resto; se clasifican a las listas/slots de tipo correspondientes del pipeline

2. **Given** el mismo pool  
   **When** se completa el fill hacia targets de tipo  
   **Then** slots no-creature pueden recibir cartas legales del pool (no solo backfill `Unknown`); creatures siguen recibiendo creatures legales

3. **Given** `formatMode === 'commander'`  
   **When** se genera  
   **Then** regresión: fill/EDHREC commander no se rompe

4. **Given** el código  
   **When** se inspecciona  
   **Then** no se inventa scorer nuevo; solo corrige clasificación/consumo del pool legal en el fill

## SyRS atómicos
- SYRS-B33-01: Pool legal alimenta fill multi-tipo, no solo creatures.
- SYRS-B33-02: listados no-creature no quedan vacíos por dump-all-to-creatures cuando el pool tiene esos tipos.
- SYRS-B33-03: Commander regresión.
- SYRS-B33-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Scryfall page1; hydrate load; DECK_FORMAT_CONFIGS; e2e; Fix Mana; rewrite scorers.
