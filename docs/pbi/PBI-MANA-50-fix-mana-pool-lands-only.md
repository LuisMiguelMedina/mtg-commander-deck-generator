# PBI-MANA-50 — Fix Mana Pool: botón + rebalance solo lands

**Base:** main @ `d2f2372` · ADR `/workspace/arquitectura/ADR-fix-mana-pool.md` · VoBo Luis SÍ (Blob) · Stream paralelo a Foundry format-first

## User story
Como jugador con un mazo generado, quiero un botón «Fix Mana Pool» bajo PIP DEMAND que rebalancee solo Lands (incl. flex) para acercar sources al pip demand, sin regenerar el mazo ni tocar spells.

## Acceptance criteria (GWT)
1. **Given** un mazo cargado en DeckDisplay (apartado Mana)  
   **When** se renderiza PIP DEMAND + pills  
   **Then** hay un botón propio «Fix Mana Pool» centrado debajo; enabled si hay mazo cargado

2. **Given** mazo con spells + lands  
   **When** se ejecuta Fix Mana Pool  
   **Then** solo muta entradas Land (incl. flex/MDFC land); la lista de no-lands (spells/artifacts/etc.) queda idéntica (mismo multiset de nombres)

3. **Given** Fix Mana Pool  
   **When** se corre  
   **Then** **no** invoca regenerate / `generateDeck` completo; es rebalance local sobre el mazo actual

4. **Given** inputs  
   **When** el algoritmo decide swaps/adds/cuts  
   **Then** usa métricas ya mostradas: pip demand (`calculateManaPips` o equivalente), sources (`calculateManaProduction`), land count/targets existentes; ranking reusa scores/popularidad del land pick de generate (provider del formatMode) — **sin scorer nuevo**

5. **Given** candidatos land  
   **When** se filtran  
   **Then** legalidad `formatMode` (commander|brawl100) + color identity; **nunca** entran banned/restricted

## SyRS atómicos
- SYRS-M50-01: Botón «Fix Mana Pool» bajo PIP DEMAND; enabled con mazo.
- SYRS-M50-02: Solo rebalancea Lands; no toca spells; no regenerate.
- SYRS-M50-03: Inputs = pip/sources/targets mostrados; scores existentes; excluye banned/restricted.
- SYRS-M50-04: Acceptance en rojo hasta green Dev.

## Fuera de alcance
Reglas de maná nuevas; polish; e2e; Standard 60; Foundry format-first (otro stream).
