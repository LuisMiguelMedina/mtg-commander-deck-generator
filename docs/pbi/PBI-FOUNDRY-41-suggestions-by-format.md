# PBI-FOUNDRY-41 — Top/sugerencias por formatMode (EDHREC | Moxfield)

**Base:** main @ `d2f2372` · ADR Foundry format-first · VoBo Luis SÍ

## User story
Como jugador en paso 2, quiero ver Top/sugerencias coherentes con el formato: EDHREC en Commander y Moxfield (o search-only) en Brawl, nunca pills EDHREC en brawl100.

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'commander'` en landing paso 2  
   **When** se cargan Top / sugerencias  
   **Then** la fuente es EDHREC nativo (comportamiento actual «Top Commanders on EDHREC» + filtros de color)

2. **Given** `formatMode === 'brawl100'` y Moxfield Top OK  
   **When** se cargan sugerencias  
   **Then** salen de puerto `CommanderSuggestionsProvider` / Moxfield (misma familia popularity); **cero** pills/listas EDHREC

3. **Given** `formatMode === 'brawl100'` y Moxfield 403/5xx/vacío/sin endpoint Top / flag off  
   **When** se cargan sugerencias  
   **Then** degrade a **search-only** + `limitedData` (banner tipo «busca un commander legal en Brawl»); pills Top vacías; **no** rellenar con EDHREC

4. **Given** el código  
   **When** se inspecciona el seam  
   **Then** existe seam delgado `suggestionsFor(formatMode)` (o equivalente) que conmuta EDHREC vs Moxfield|degrade; no reescribe scorers

## SyRS atómicos
- SYRS-F41-01: commander → Top EDHREC.
- SYRS-F41-02: brawl100 → Moxfield Top o search-only+limitedData; nunca EDHREC.
- SYRS-F41-03: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Top Brawl “perfecto” si Moxfield no expone ranking; Fix Mana; e2e.
