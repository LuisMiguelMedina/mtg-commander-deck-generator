# PBI-BRAWL-30 — formatMode solo conmuta size fijo 1+99 (cero path 60)

**ADR:** ADR-brawl-residuales-pr5.md v3 · Base PR #5 @ `44bd898` · VoBo Luis limpio

## User story
Como usuario, quiero solo `commander` | `brawl100` con tamaño fijo 1+99, sin custom size ni ningún path que deje `deckFormat` en 60.

## Acceptance criteria (GWT)
1. **Given** FormatModeSelector / modelo de UI  
   **When** se listan opciones  
   **Then** solo `commander` y `brawl100` (sin `standardBrawl60`, sin chip 60, sin control custom size que escriba tamaño arbitrario)

2. **Given** store / Customization  
   **When** se setea `formatMode`  
   **Then** el tamaño efectivo es siempre `getFormatRules(formatMode).deckSize` (99); no hay escritura UI de `deckFormat: 60`

3. **Given** persistencia / hidratación con `deckFormat` legacy 60  
   **When** se carga el estado  
   **Then** se normaliza a 99 (o al size de `getFormatRules(formatMode)`)

4. **Given** `generateDeck` / `calculateTargetCounts` / brew  
   **When** se dimensiona el mazo  
   **Then** la fuente de verdad es `getFormatRules(formatMode).deckSize`, no un custom size libre

5. **Given** `formatMode === 'commander'`  
   **When** se usa el producto  
   **Then** regresión: flujo EDHREC/commander intacto en tamaño 99

## SyRS atómicos
- SYRS-B30-01: Cero UI custom size / path `deckFormat: 60` / `standardBrawl60` seleccionable.
- SYRS-B30-02: Size solo vía `getFormatRules(formatMode)`.
- SYRS-B30-03: Legacy 60 → 99 al hidratar.
- SYRS-B30-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
e2e; Standard 60; polish; features nuevas.
