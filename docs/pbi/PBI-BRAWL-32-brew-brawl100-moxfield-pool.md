# PBI-BRAWL-32 — Brew brawl100: Moxfield|degrade + pool legal (pre-finishBrew)

**Base:** PR #6 @ `1ae716d` · Gaps limpio ADR v3 (VoBo Luis: «resuelve lo que queda») · Fuera: Scryfall page1, hydrate load, DECK_FORMAT_CONFIGS 40/60

## User story
Como brewer en `brawl100`, quiero que `prepareBrewContext` / resolución de offers use Moxfield (o degrade) y el pool legal del formatMode antes de `finishBrew`, sin caer a EDHREC ni dejar el pool de candidatos vacío.

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'brawl100'`  
   **When** `prepareBrewContext` / `resolveBrewFormatPlan` (o equivalente pre-`finishBrew`) prepara candidates/offers  
   **Then** no se usa el path EDHREC de commander (`fetchEdhrec` / listas EDHREC) como fuente de offers; se invoca Moxfield (`searchBrawl100Decks` / popularity provider) o el degrade documentado

2. **Given** `formatMode === 'brawl100'` y Moxfield responde OK  
   **When** se construye el candidate pool pre-`finishBrew`  
   **Then** el pool de candidatos/offers **no** está vacío por saltarse el fetch de popularidad brawl; las offers salen de Moxfield∩legal (o ranking adaptado), no de EDHREC

3. **Given** Moxfield 403/5xx/vacío/flag off  
   **When** brew prepara contexto  
   **Then** degrade a pool legal Scryfall (`dataSource: 'scryfall'` / `limitedData` ok); brew no bloquea; candidate pool no queda vacío solo por el fallo de Moxfield si hay pool legal

4. **Given** `formatMode === 'commander'`  
   **When** brew prepara contexto  
   **Then** regresión: EDHREC / path commander intacto

5. **Given** el código  
   **When** se inspecciona el path brew brawl100  
   **Then** no hay stub `search → 403` fijo; no se reescribe el scorer; solo corrige fuente de offers/pool pre-`finishBrew`

## SyRS atómicos
- SYRS-B32-01: Brew `brawl100` pre-`finishBrew` usa Moxfield|degrade, no EDHREC.
- SYRS-B32-02: Candidate/offers pool no vacío por skip de popularidad brawl cuando hay datos o pool legal.
- SYRS-B32-03: Degrade documentado; commander regresión.
- SYRS-B32-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Scryfall page1; hydrate en load; DECK_FORMAT_CONFIGS 40/60; e2e; rewrite scorers; Fix Mana Pool.
