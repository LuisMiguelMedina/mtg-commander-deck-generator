# ADR addendum: wiring UI FormatMode (Brawl 100)

Base: SHA `3fcb3b4` seams (`formatMode.ts`, `legality.ts`, `popularity/provider.ts`, moxfield flags/fmt). Cero UI hoy.

## Decisión
Cablear **FormatMode en store + selector compartido**, no reutilizar el chip de tamaño `deckFormat: 60|99` como modo (60 ≠ `standardBrawl60`).

### Estado
- `Customization.formatMode: FormatMode` default `'commander'`
- Al setear modo: sincronizar `deckFormat = getFormatRules(mode).deckSize` (brawl100 → 99)
- Extender `DeckDataSource` con `'moxfield'` (provider ya lo emite)

### UI
- Nuevo `FormatModeSelector` (o bloque top en `DeckCustomizer`):
  - seleccionables: `commander` | `brawl100`
  - `standardBrawl60`: disabled/nombrado, sin path
  - copy vida: `getFormatRules('brawl100').lifeCopy`
- Montaje: `DeckCustomizer` → cubre **Builder** (`BuilderPage`) y **Brew** (`BrewSetup`)

### Generación / hooks
| Punto | Qué hacer |
|-------|-----------|
| `store` + `updateCustomization` | persistir `formatMode` |
| `CommanderSearch` / `setCommander` | `isEligibleCommander(card, formatMode)` |
| `BuilderPage` → `generateDeck` | pasar mode; filtrar pool con `isLegalForFormat`; si brawl100: `popularityProviderFor` + `getBrawl100Popularity({ flagEnabled: MOXFIELD_POPULARITY_ENABLED_DEFAULT, search })`; degradación → `dataSource: 'scryfall'` |
| Temas EDHREC en brawl100 | no fetch / UI themes off o vacío |
| `BrewPage` load EDHREC | ramificar por `formatMode` (mismo puerto popularidad) |
| `prepareBrewContext` / `finishBrew` | leer `formatMode` + rules size/legalidad |

### Fuera
Standard 60 gen, polish, Pages/AWS, rewrite profundo del motor (solo plumb seams; si inclusion Moxfield no alimenta aún al scorer, degradar documentado + PBI follow-up).

## Criterio listo QA PBI
1. Selector visible en Builder y Brew; solo commander|brawl100 activos
2. brawl100 → 1+99, copy 25 vida / no commander damage
3. Generar (o start brew) con mode brawl100 usa legality.brawl + Moxfield flag ON (o scryfall si degrade)
4. Regresión: mode commander = flujo EDHREC previo
5. standardBrawl60 no genera
