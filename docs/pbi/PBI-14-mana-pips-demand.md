# PBI-14 — Demanda de fuentes por pips (Commander)

**Upstream:** https://github.com/20q2/mtg-commander-deck-generator/issues/14  
**Repo trabajo:** LuisMiguelMedina/mtg-commander-deck-generator  
**VoBo fórmula (errata Luis / Blob):** `demand = Math.ceil(0.8 * pips + 2)`

## User story
Como builder de un mazo Commander, quiero que la demanda de fuentes de maná por color use la fórmula escalada a 99 cartas, para que las barras y sugerencias no exijan pips 1:1 ni subestimen con la regla de 60.

## Acceptance criteria (GWT)
1. **Given** un requisito de color con `pips = 5`  
   **When** se calcula la demanda de fuentes  
   **Then** `demand === Math.ceil(0.8 * 5 + 2)` (= 6)

2. **Given** un requisito de color con `pips = 4`  
   **When** se calcula la demanda  
   **Then** `demand === Math.ceil(0.8 * 4 + 2)` (= 6)

3. **Given** un requisito de color con `pips = 30`  
   **When** se calcula la demanda  
   **Then** `demand === Math.ceil(0.8 * 30 + 2)` (= 26)

4. **Given** la barra de progreso de demanda para un color  
   **When** se renderiza el 100%  
   **Then** el 100% corresponde a `sources >= demand` con esa fórmula (no a `sources/pips*50` ni a pips crudos 1:1)

5. **Given** el cálculo de demanda  
   **When** se evalúa  
   **Then** no se usa `Math.floor(pips/2)+1` ni `pips` como demanda directa

## SyRS atómicos
- SYRS-14-01: Función pura (o equivalente exportable) `computeManaSourceDemand(pips: number): number` implementa `Math.ceil(0.8 * pips + 2)`.
- SYRS-14-02: UI de barras / sugerencias de fuentes consume esa misma demanda (una sola fuente de verdad).
- SYRS-14-03: Para `pips` entero ≥ 0, el resultado es entero ≥ 2 cuando pips=0 → `Math.ceil(2)=2` (documentar edge; tests cubren pips>0 del issue).
- SYRS-14-04: Tests de aceptación en rojo existen antes del green de Dev.

## Fuera de alcance
- Cambiar generación de lands / algoritmo de sugerencia más allá de alinear demand.
- Implementación de producción (solo tests + este PBI).
