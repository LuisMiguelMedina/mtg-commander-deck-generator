# PBI-BRAWL-01 — FormatMode + reglas Brawl 100

**ADR:** ADR-brawl-fase1.md · VoBo Luis: FormatMode (extender, no fork)

## User story
Como builder, quiero elegir modo Brawl 100 (además de Commander) para generar un mazo 1+99 con reglas Brawl.

## Acceptance criteria (GWT)
1. **Given** el producto  
   **When** se selecciona FormatMode  
   **Then** existen `commander` | `brawl100` y queda reservado/nombrado `standardBrawl60` sin implementar

2. **Given** FormatMode `brawl100`  
   **When** se valida el mazo  
   **Then** tamaño es 1 comandante + 99; singleton; color identity; comandante legendario o PW (y Vehicle/Spacecraft elegible si el ADR/reglas lo permiten)

3. **Given** FormatMode `brawl100`  
   **When** se muestra copy de reglas de vida  
   **Then** indica 25 vida 1v1 y no commander damage (sin simulación de daño en fase 1)

4. **Given** FormatMode `commander`  
   **When** se generan/validan reglas  
   **Then** el comportamiento Commander existente no se rompe (regresión)

## SyRS atómicos
- SYRS-B1-01: Tipo/enum `FormatMode` con valores anteriores.
- SYRS-B1-02: `DeckFormatConfig` (o equivalente) para Brawl 100: deckSize 99, singleton true, startingLife 25, commanderDamage false.
- SYRS-B1-03: Tests unitarios de config/reglas en rojo hasta green de Dev.
- SYRS-B1-04: `standardBrawl60` solo nombrado / type-level; sin path de generación.

## Fuera de alcance
UI polish; Standard Brawl 60 implementación.
