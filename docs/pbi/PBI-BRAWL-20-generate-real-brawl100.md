# PBI-BRAWL-20 — generateDeck real brawl100 (quitar stub)

**ADR:** ADR-brawl-ui-followup-pr4.md · Base PR #4 @ `029c258` · VoBo Luis follow-up

## User story
Como builder/brewer en FormatMode `brawl100`, quiero que la generación use un pool Scryfall legal real y ranking Moxfield (con degrade), no un stub de `pool: []` / search 403 fijo.

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'brawl100'`  
   **When** se prepara el pipeline de `generateDeck` (o seam `resolveBuilderFormatPipeline` / orquestación)  
   **Then** el `pool` pasado es un array real de candidatos filtrados con `isLegalForFormat(card, 'brawl100')` (no `[]` stub)

2. **Given** `formatMode === 'brawl100'` y flag Moxfield ON (`MOXFIELD_POPULARITY_ENABLED_DEFAULT`)  
   **When** se resuelve popularidad  
   **Then** se invoca cliente Moxfield real vía `getBrawl100Popularity({ flagEnabled: true, search })` (≤1 rps / TTL documentados en seams existentes)

3. **Given** respuesta Moxfield con cartas  
   **When** se adapta al ranking  
   **Then** existe adaptador `cards[]` → shape tipo EDHREC (`name`, `inclusion`/`count`) que alimenta el path de ranking existente

4. **Given** Moxfield 403 / 5xx / vacío / flag off  
   **When** se genera  
   **Then** degrade a `dataSource: 'scryfall'`, pool legal sin ranking (`limitedData` ok); generate no bloquea solo por fallo Moxfield

5. **Given** generación exitosa en `brawl100`  
   **When** se valida el mazo  
   **Then** tamaño 1 comandante + 99 (`getFormatRules('brawl100').deckSize`); cartas del main cumplen legalidad brawl (vía seams)

6. **Given** `formatMode === 'commander'`  
   **When** se genera  
   **Then** path EDHREC previo se preserva (regresión; sin stub brawl)

7. **Given** el código de generate brawl100  
   **When** se inspecciona  
   **Then** no queda stub fijo `pool: []` ni `search` que siempre retorna 403 en el path de producción

## SyRS atómicos
- SYRS-B20-01: Orquestación brawl100 construye pool Scryfall filtrado por `isLegalForFormat(..., 'brawl100')`.
- SYRS-B20-02: Popularidad usa `getBrawl100Popularity` con flag default ON + cliente real.
- SYRS-B20-03: Adaptador Moxfield→ranking EDHREC-shape.
- SYRS-B20-04: Degrade documentado a scryfall sin ranking.
- SYRS-B20-05: Deck size desde `getFormatRules(formatMode).deckSize` (99), no chip numérico.
- SYRS-B20-06: Acceptance tests en rojo hasta green de Dev.

## Fuera de alcance
e2e UI; Standard 60; polish; AWS; rewrite profundo del scorer.
