# PBI-MANA-51 — Fix Mana: déficit/exceso + tamaño 1+99 + dual formatMode

**Base:** main @ `d2f2372` · ADR Fix Mana Pool · VoBo Luis SÍ

## User story
Como jugador, quiero que Fix Mana cubra déficit de fixing con flex, recorte lands peores si hay exceso, y preserve el tamaño de mazo (1+99) en commander y brawl100.

## Acceptance criteria (GWT)
1. **Given** déficit de fixing/sources vs pip demand  
   **When** Fix Mana Pool corre  
   **Then** swap o add flex-lands que cubran colores faltantes (preferir swap 1:1; add solo si hay hueco land bajo target)

2. **Given** exceso de lands vs target  
   **When** Fix Mana Pool corre  
   **Then** quita lands de peor score / peor fit de color; conserva las adecuadas

3. **Given** cualquier rebalance  
   **When** termina  
   **Then** tamaño de mazo = `getFormatRules(formatMode).deckSize` (commander/brawl100 → 1+99 intacto: commander(s) + 99)

4. **Given** `formatMode === 'commander'` y `formatMode === 'brawl100'`  
   **When** Fix Mana Pool corre  
   **Then** mismo comportamiento de rebalance; legalidad + provider de popularidad según mode (ADR v3)

5. **Given** post-fix  
   **When** se comparan pip/sources o land fit  
   **Then** pip/sources mejoran **o** lands se ajustan al target; no-lands sin cambio

## SyRS atómicos
- SYRS-M51-01: Déficit → flex fixing; exceso → cut peores.
- SYRS-M51-02: Tamaño 1+99 / deckSize del formatMode intacto.
- SYRS-M51-03: Funciona commander y brawl100.
- SYRS-M51-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Spells; scorer nuevo; Fix Mana UI polish; e2e.
