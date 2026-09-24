# PBI-FOUNDRY-40 — Landing: format primero → commander

**Base:** main @ `d2f2372` · ADR `/workspace/arquitectura/ADR-foundry-format-first.md` · VoBo Luis SÍ (Blob)

## User story
Como jugador en Foundry landing, quiero elegir primero Historic Brawl o Commander y solo después buscar/elegir commander, para no mezclar legalidad ni popularidad entre formatos.

## Acceptance criteria (GWT)
1. **Given** la landing Foundry / Builder  
   **When** se muestra el paso 1  
   **Then** el paso 1 es **Choose format** con exactamente dos opciones: Historic Brawl → `formatMode='brawl100'` y Commander → `formatMode='commander'`; no existe path / opción formato 60 / Standard Brawl

2. **Given** aún no hay `formatMode` elegido en landing  
   **When** se inspecciona la UI de paso 2 (search / top commanders)  
   **Then** el paso 2 (choose commander) **no** está disponible o no permite selección hasta elegir formato

3. **Given** `formatMode` ya elegido  
   **When** se muestra el paso 2  
   **Then** el search de commander filtra con `isEligibleCommander(card, formatMode)` (brawl100 = legality.brawl + reglas Brawl; commander = reglas EDH)

4. **Given** el usuario elige un formato en landing  
   **When** se lee el store  
   **Then** `formatMode` escrito es la misma clave que usa DeckCustomizer / generate (una fuente de verdad)

## SyRS atómicos
- SYRS-F40-01: Paso 1 = solo Historic Brawl | Commander → brawl100|commander; cero path 60.
- SYRS-F40-02: Paso 2 gated tras formato; search eligibility por formatMode.
- SYRS-F40-03: Landing escribe el mismo `formatMode` del store de generate/customizer.
- SYRS-F40-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Fix Mana; polish/hero marketing; e2e Playwright; rewrite scorers; formato 60.
