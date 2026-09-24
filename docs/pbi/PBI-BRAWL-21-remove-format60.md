# PBI-BRAWL-21 — Quitar chip/path 60 y standardBrawl60 de UI

**ADR:** ADR-brawl-ui-followup-pr4.md · VoBo Luis: Standard 60 fuera de roadmap

## User story
Como usuario, quiero elegir solo `commander` | `brawl100` (ambos 1+99), sin chip de tamaño 60 ni modo Standard Brawl que confunda tamaño con formato.

## Acceptance criteria (GWT)
1. **Given** FormatModeSelector (DeckCustomizer)  
   **When** se renderiza el modelo de opciones  
   **Then** solo `commander` y `brawl100` son seleccionables; no hay opción activa ni disabled visible de `standardBrawl60` ni chip `deckFormat: 60`

2. **Given** store / Customization  
   **When** se setea `formatMode` a `commander` o `brawl100`  
   **Then** el tamaño efectivo es `getFormatRules(mode).deckSize` (99); generate no usa chip 60 como fuente de verdad

3. **Given** UI de customización  
   **When** se busca control de tamaño 60  
   **Then** no existe path de escritura UI que setee `deckFormat: 60` (remover u ocultar chip; cero dead UI)

4. **Given** intento de generar / brew con `standardBrawl60` o tamaño 60 como modo  
   **When** se pide generación  
   **Then** no hay rama generable (modo removido del producto en este slice; si type queda por compat, `generation: 'removed'` y no expuesto)

5. **Given** `formatMode === 'commander'`  
   **When** se usa Builder/Brew  
   **Then** flujo EDHREC/commander sin regresión funcional

## SyRS atómicos
- SYRS-B21-01: Selector expone únicamente commander | brawl100.
- SYRS-B21-02: Sin UI/path `deckFormat: 60` ni `standardBrawl60` seleccionable/generable.
- SYRS-B21-03: Tamaño solo vía `getFormatRules(formatMode)`.
- SYRS-B21-04: Tests previos que asumen chip 60 / standardBrawl60 visible se actualizan o dejan de assertar dead UI (este PBI: acceptance nuevos en rojo; Dev limpia asserts en green).
- SYRS-B21-05: Acceptance tests en rojo hasta green de Dev.

## Fuera de alcance
e2e UI; reintroducir Standard 60 (nuevo VoBo); polish.
