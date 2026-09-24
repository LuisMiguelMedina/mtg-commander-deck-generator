# PBI-13 — Total UI = 99 al cumplir main targets (lands + MDFC)

**Upstream:** https://github.com/20q2/mtg-commander-deck-generator/issues/13  
**Repo trabajo:** LuisMiguelMedina/mtg-commander-deck-generator

## User story
Como builder, al cumplir los main targets quiero ver un total de 99 en la UI (contando lands y MDFC), para que el layout sea intuitivo y el mazo Commander cierre a 99 + commander.

## Acceptance criteria (GWT)
1. **Given** main targets cumplidos (categorías principales al target)  
   **When** la UI muestra el total del mazo  
   **Then** el total mostrado es **99**, incluyendo lands ya añadidos y cartas MDFC contadas de forma consistente con el layout

2. **Given** lands en el mazo y slots de main targets  
   **When** se suma el total mostrado  
   **Then** lands **sí** forman parte del total (no se omiten)

3. **Given** una o más MDFC en el mazo  
   **When** se suma el total mostrado  
   **Then** cada MDFC cuenta **una** vez hacia el total de 99 (no se pierde ni se doble-cuenta de forma que rompa el 99)

4. **Given** targets no cumplidos  
   **When** se muestra el total  
   **Then** este PBI no exige 99; solo cuando main targets están cumplidos

## SyRS atómicos
- SYRS-13-01: Función/regla de agregación del total UI incluye lands + no-lands (incl. MDFC) hacia 99.
- SYRS-13-02: Al estado “main targets met”, `uiDeckTotal === 99`.
- SYRS-13-03: MDFC: una entrada de deck = 1 hacia el total.
- SYRS-13-04: Tests de aceptación en rojo existen antes del green de Dev.

## Fuera de alcance
- Rediseño visual de la barra de targets.
- Implementación de producción (solo tests + este PBI).
