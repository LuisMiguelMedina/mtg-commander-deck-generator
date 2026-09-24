# ADR addendum v2: follow-up PR #4 (VoBo Luis condicionado)

Base: PR #4 @ `029c258` (open, hold merge). Segundo VoBo pendiente.

## Cambio de producto (Luis)
Eliminar por completo el formato 60 del producto en este slice y del roadmap cercano:
- Sin Standard Brawl / `standardBrawl60` / chip 60 / `deckFormat: 60`.
- Motivo: riesgo de dañar el producto (confusión tamaño↔modo).
- Foco solo: **Commander** (existente) + **Historic Brawl (`brawl100`)** — ambos 1+99.

## Hallazgo residual
`generateDeck` aún llama pipeline con stub (`pool: []`, `search → 403`). Moxfield no rankea lista real.

## Decisión

### A) Generación real brawl100 (quitar stub) — sin cambio vs v1
| Punto | Cableado |
|-------|----------|
| Pool | Candidatos Scryfall (color identity + cache); filtrar `isLegalForFormat(card, 'brawl100')`; array real a pipeline. |
| Search | Cliente Moxfield real (≤1 rps, TTL, UA); `getBrawl100Popularity({ flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT, search })`. |
| Adaptador | `cards[]` Moxfield → shape tipo EDHREC (`name`, `inclusion`/`count`) → path ranking existente. |
| Degrade | 403/5xx/vacío/flag off → `dataSource: 'scryfall'`, pool legal sin ranking (`limitedData` ok). |
| Commander | Path EDHREC intacto (regresión). |

### B) Tamaño y UI — revisión (antes: chip 60 disabled; ahora: remover)
- `formatMode` ∈ {`commander`, `brawl100`} únicamente seleccionable.
- Tamaño **solo** `getFormatRules(formatMode).deckSize` (siempre 99). Quitar dependencia de chip/`deckFormat` numérico como fuente de verdad en generate.
- **Remover u ocultar** chip 60 y cualquier UI/path que ofrezca `deckFormat: 60` o `standardBrawl60` en este slice (no dead UI).
- Enum/types: `standardBrawl60` fuera del selector y sin rama de generación; si queda en type por compat, `generation: 'removed'` / no expuesto (preferible borrar del modelo de UI).
- Store: al setear `formatMode`, sync size a 99; no aceptar escritura de 60 desde UI.

### Fuera de alcance
e2e UI; Standard 60 (fuera de roadmap hasta nuevo VoBo); polish; AWS/Pages; rewrite profundo del scorer.

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Rate-limit / ToS Moxfield | Flag ON + degrade Scryfall obligatorio; ≤1 rps + cache. |
| Adaptador inclusión incompleto vs EDHREC themes | Degrade documentado; no bloquear generate. |
| Usuarios que usaban chip 60 como “mazo corto” Commander | Copy: tamaño fijo 99 por formato; sin alternativa 60 en UI. |
| Dead code / tests que asumen 60 o `standardBrawl60` | Borrar o skip en este slice; no dejar asserts de chip 60. |

## Criterio listo QA (tras VoBo limpio)
1. Solo selector `commander` \| `brawl100`; cero chip/path 60 ni `standardBrawl60` visible o generable.
2. brawl100: pool legal no vacío + Moxfield invocado (flag ON); 403→degrade Scryfall; mazo 1+99 legal.
3. Stub (`pool []` / search 403 fijo) eliminado.
4. Regresión commander EDHREC.
5. Sin e2e en este slice.

## Estado
Diseño para **segundo VoBo Luis**. Sin handoff QA hasta VoBo limpio.
