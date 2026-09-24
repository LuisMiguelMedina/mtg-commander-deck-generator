# PBI-BRAWL-02 — Legalidad Scryfall `legalities.brawl`

**VoBo Luis:** gate Scryfall `legalities.brawl`; mazo 1+99 Brawl 100

## User story
Como builder en Brawl 100, quiero que el pool solo ofrezca cartas legales en Brawl según Scryfall.

## Acceptance criteria (GWT)
1. **Given** FormatMode `brawl100`  
   **When** se construye el pool de cartas  
   **Then** solo entran cartas con `legalities.brawl === 'legal'`

2. **Given** una carta `legalities.brawl !== 'legal'`  
   **When** se intenta incluir en sugerencias/validación Brawl 100  
   **Then** se rechaza / no aparece en pool

3. **Given** FormatMode `commander`  
   **When** se filtra el pool  
   **Then** no se aplica el gate `brawl` (sigue el gate Commander actual)

4. **Given** restricciones Arena del producto  
   **When** aplica `arenaOnly` / `game:arena`  
   **Then** se reutilizan sin romper el gate brawl (composición AND si ambos activos)

## SyRS atómicos
- SYRS-B2-01: Función pura `isLegalForFormat(card, mode)` (o seam existente) con rama `brawl100` → `legalities.brawl === 'legal'`.
- SYRS-B2-02: Tests con fixtures de cartas legal/not_legal/banned/restricted.
- SYRS-B2-03: Sin llamadas de red en unit tests (fixtures).

## Fuera de alcance
Cambiar rate limiter/cache Dexie de Scryfall.
