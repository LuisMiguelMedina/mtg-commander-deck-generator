# PBI-BRAWL-11 — Builder: generar con FormatMode brawl100

**ADR:** ADR-brawl-ui-wiring.md · Seams: `formatMode.ts`, `legality.ts`, `popularity/provider.ts`, moxfield flags · VoBo Luis

## User story
Como builder, al elegir brawl100 quiero que la generación use elegibilidad Brawl, legalidad Scryfall `brawl`, popularidad Moxfield (flag ON + degrade) y sin temas EDHREC.

## Acceptance criteria (GWT)
1. **Given** `formatMode === 'brawl100'`  
   **When** se valida un candidato a comandante (`CommanderSearch` / `setCommander` / seam exportado)  
   **Then** se usa `isEligibleCommander(card, 'brawl100')` (no solo reglas commander)

2. **Given** `formatMode === 'brawl100'` y generaciónde mazo  
   **When** se filtra el pool de cartas  
   **Then** cada carta incluida pasa `isLegalForFormat(card, 'brawl100')` (Scryfall `legalities.brawl === 'legal'`)

3. **Given** `formatMode === 'brawl100'`  
   **When** se resuelve popularidad para generar  
   **Then** se invoca el puerto Brawl (`getBrawl100Popularity` / `popularityProviderFor`) con `flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT` (true) y, si Moxfield falla/degrada, `dataSource: 'scryfall'` (o equivalente documentado)

4. **Given** `formatMode === 'brawl100'`  
   **When** se piden temas EDHREC  
   **Then** no hay fetch de themes EDHREC (UI themes off / vacío)

5. **Given** `formatMode === 'commander'`  
   **When** se genera  
   **Then** el flujo EDHREC previo se preserva (regresión)

6. **Given** `formatMode === 'standardBrawl60'` (o intento de generar ese mode)  
   **When** se pide generación  
   **Then** no genera (`generation: 'named-only'` / rechazo explícito)

## SyRS atómicos
- SYRS-B11-01: BuilderPage → generateDeck (o seam de orquestación) recibe/lee `formatMode`.
- SYRS-B11-02: Path brawl100 cablea `isEligibleCommander`, `isLegalForFormat`, popularidad Moxfield+degrade.
- SYRS-B11-03: Themes EDHREC desactivados en brawl100.
- SYRS-B11-04: Commander path sin regresión funcional documentada en tests.
- SYRS-B11-05: `standardBrawl60` sin path de generación.
- SYRS-B11-06: Acceptance tests en rojo hasta green de Dev.

## Fuera de alcance
Scoring profundo si Moxfield aún no alimenta scorer (degradar documentado + PBI follow-up); Pages/AWS.
