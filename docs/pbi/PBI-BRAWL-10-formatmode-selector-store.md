# PBI-BRAWL-10 — FormatMode en store + FormatModeSelector

**ADR:** ADR-brawl-ui-wiring.md · Base seams: `3fcb3b4` · VoBo Luis wiring UI

## User story
Como builder/brewer, quiero elegir FormatMode (commander | brawl100) en el customizer compartido para que Builder y Brew usen el mismo modo sin confundirlo con el chip de tamaño 60/99.

## Acceptance criteria (GWT)
1. **Given** Customization  
   **When** se lee el estado por defecto  
   **Then** `formatMode` es `'commander'`

2. **Given** Customization  
   **When** se setea `formatMode` a `brawl100` vía `updateCustomization` (o API equivalente del store)  
   **Then** `formatMode` persiste como `brawl100` y `deckFormat` sincroniza a `getFormatRules('brawl100').deckSize` (99)

3. **Given** Customization  
   **When** se setea `formatMode` a `commander`  
   **Then** `deckFormat` sincroniza a `getFormatRules('commander').deckSize` (99) y el flujo commander no se rompe

4. **Given** el chip/control de tamaño `deckFormat: 60 | 99`  
   **When** el usuario lo cambia  
   **Then** **no** se mapea a FormatMode (`60` ≠ `standardBrawl60`; no confundir tamaño con modo)

5. **Given** `DeckCustomizer` montado (Builder y BrewSetup)  
   **When** se renderiza FormatModeSelector (o bloque top)  
   **Then** opciones seleccionables: `commander` | `brawl100`; `standardBrawl60` visible como disabled/nombrado sin path; copy de vida brawl100 = `getFormatRules('brawl100').lifeCopy`

6. **Given** tipo `DeckDataSource`  
   **When** se inspecciona el union  
   **Then** incluye `'moxfield'` además de las fuentes existentes (p. ej. edhrec/scryfall)

## SyRS atómicos
- SYRS-B10-01: `Customization.formatMode: FormatMode` default `'commander'`.
- SYRS-B10-02: Al cambiar mode, `deckFormat = getFormatRules(mode).deckSize` (solo modes con generation implemented).
- SYRS-B10-03: `FormatModeSelector` montado vía `DeckCustomizer` (cubre BuilderPage + BrewSetup).
- SYRS-B10-04: No hay función/mapping que trate `deckFormat === 60` como FormatMode.
- SYRS-B10-05: `DeckDataSource` incluye `'moxfield'`.
- SYRS-B10-06: Acceptance tests en rojo hasta green de Dev.

## Fuera de alcance
Polish visual; Standard Brawl 60 generación; rewrite del motor.
