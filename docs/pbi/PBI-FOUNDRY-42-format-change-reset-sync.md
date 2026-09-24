# PBI-FOUNDRY-42 — Reset al cambiar format + sync store + regresión commander

**Base:** main @ `d2f2372` · ADR Foundry format-first · VoBo Luis SÍ

## User story
Como jugador, al cambiar de formato quiero que se limpie el commander y las sugerencias del modo anterior, y que generate/brew hereden el formatMode del store sin romper el flujo commander.

## Acceptance criteria (GWT)
1. **Given** un commander (y/o sugerencias) ya cargados bajo un formatMode  
   **When** el usuario cambia formatMode en landing (o el setter de format del store)  
   **Then** se resetea commander seleccionado + sugerencias cacheadas del mode anterior (no identity/legalidad cruzada)

2. **Given** `formatMode` seteado desde landing  
   **When** DeckCustomizer / generate / brew leen el store  
   **Then** usan el mismo `formatMode` (sync; sin segunda fuente de verdad)

3. **Given** `formatMode === 'commander'` (path existente)  
   **When** se ejercita search + Top EDHREC + generate  
   **Then** regresión: comportamiento commander intacto (no rotura por el slice format-first)

4. **Given** el slice  
   **When** se implementa  
   **Then** solo tipado/UI/store/suggestions seam necesarios; sin features fuera ADR; sin path 60

## SyRS atómicos
- SYRS-F42-01: Cambio de format resetea commander + suggestions.
- SYRS-F42-02: Store formatMode sync con DeckCustomizer/generate/brew.
- SYRS-F42-03: Regresión commander OK.
- SYRS-F42-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Fix Mana; Standard 60; polish; e2e full UI.
