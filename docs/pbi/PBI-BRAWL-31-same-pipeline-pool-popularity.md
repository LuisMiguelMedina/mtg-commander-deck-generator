# PBI-BRAWL-31 — Mismo pipeline; solo pool legal + popularidad

**ADR:** ADR-brawl-residuales-pr5.md v3 · VoBo Luis: sin maquinaria extra / sin rewrite scorers

## User story
Como builder/brewer, quiero que commander y brawl100 usen el mismo generate/store/scorer, diferiendo solo en pool Scryfall legal y en popularidad (EDHREC vs Moxfield).

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'brawl100'`  
   **When** `generateDeck` prepara el pool  
   **Then** el pool es real (no `[]`), filtrado con `isLegalForFormat(card, 'brawl100')`, y ese pool alimenta la selección (no solo overlay EDHREC ignorando el pool legal)

2. **Given** `formatMode === 'brawl100'`  
   **When** se resuelve popularidad  
   **Then** se usa Moxfield (`getBrawl100Popularity` / provider) con flag ON; adaptador al shape de ranking existente; sin stub search 403 fijo

3. **Given** Moxfield 403/5xx/vacío/flag off  
   **When** se genera  
   **Then** degrade a pool legal sin ranking (`dataSource: 'scryfall'` / `limitedData` ok); generate no bloquea

4. **Given** `formatMode === 'commander'`  
   **When** se genera  
   **Then** pool/popularidad EDHREC previos (regresión); mismo scorer/pipeline

5. **Given** Brew `prepareBrewContext`  
   **When** `formatMode === 'brawl100'`  
   **Then** no hay `search → 403` stub; mismo cableado Moxfield real + degrade que Builder

6. **Given** el código  
   **When** se inspecciona  
   **Then** no se reescriben scorers ni se inventa maquinaria aparte del conmutador pool+popularidad

## SyRS atómicos
- SYRS-B31-01: `formatMode` solo conmuta legalidad de pool + popularity provider.
- SYRS-B31-02: Stubs `pool: []` y brew search 403 eliminados en path producción.
- SYRS-B31-03: Pool legal brawl100 usado en el fill del mazo (no descartado).
- SYRS-B31-04: Degrade documentado; commander regresión.
- SYRS-B31-05: Acceptance en rojo hasta green Dev.

## Fuera de alcance
e2e; Standard 60; polish; rewrite scorers; features nuevas.
