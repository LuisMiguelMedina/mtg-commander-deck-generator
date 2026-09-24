# PBI-BRAWL-12 — Brew: ramificar por FormatMode

**ADR:** ADR-brawl-ui-wiring.md · VoBo Luis: Brew hoy hardcodea EDHREC

## User story
Como brewer, quiero que BrewSetup/BrewPage respeten `formatMode` (tamaño, legalidad, popularidad) en lugar de asumir siempre EDHREC/Commander.

## Acceptance criteria (GWT)
1. **Given** BrewSetup con `DeckCustomizer`  
   **When** el usuario elige `brawl100`  
   **Then** el mismo FormatModeSelector/store aplica (misma Customization que Builder)

2. **Given** `formatMode === 'brawl100'`  
   **When** Brew carga popularidad / contexto (`prepareBrewContext` / load EDHREC path)  
   **Then** ramifica al puerto de popularidad Brawl (Moxfield flag ON + degrade), no hardcodea solo EDHREC

3. **Given** `formatMode === 'brawl100'`  
   **When** `finishBrew` / reglas de tamaño  
   **Then** usa `getFormatRules('brawl100')` (deckSize 99, legalidad brawl vía seams)

4. **Given** `formatMode === 'commander'`  
   **When** se corre Brew  
   **Then** el flujo EDHREC previo se preserva (regresión)

5. **Given** `formatMode === 'standardBrawl60'`  
   **When** se intenta start brew / generate  
   **Then** no genera

## SyRS atómicos
- SYRS-B12-01: `prepareBrewContext` / load popularity lee `formatMode`.
- SYRS-B12-02: `finishBrew` aplica rules size/legalidad del mode.
- SYRS-B12-03: Path commander intacto bajo tests de regresión.
- SYRS-B12-04: Acceptance tests en rojo hasta green de Dev.

## Fuera de alcance
Minijuego polish; Standard 60 gen.
