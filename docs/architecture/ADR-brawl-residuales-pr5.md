# ADR residuales PR #5 @ `44bd898` — v3 (VoBo producto Luis: simplificar)

## Principio
Commander y Historic Brawl 100 (**brawl100**) comparten el **mismo** pipeline generate/store/scoring. Solo diferirán en:
1. **Pool legal** — Scryfall `legalities.brawl` vs `legalities.commander`
2. **Popularidad** — Moxfield vs EDHREC

Sin maquinaria extra. Sin rewrite de scorers.

## Delta mínimo (sobre PR #5)

### formatMode = conmutador
- `formatMode ∈ {commander, brawl100}`
- Al generar/brew: mismo flujo Commander; ramas solo en (a) filtro de legalidad del pool y (b) provider de popularidad (`popularityProviderFor` / Moxfield flag ON + degrade Scryfall).
- Tamaño **siempre** `getFormatRules(formatMode).deckSize` → 1+99. Eliminar custom size y **todo** path `deckFormat: 60` / `standardBrawl60` (UI, store, generate, persist legacy→99).

### Quitar stubs (sin rediseñar motor)
- `generateDeck`: pool real vía Scryfall filtrado por legalidad del mode (no `pool: []`); search Moxfield real en brawl100 (no 403 fijo); adaptador name/inclusion al shape que ya consume el ranking.
- Brew (`prepareBrewContext`): mismo search real + degrade; quitar `search → 403` stub.
- Degrade 403/5xx/vacío/flag off → pool legal sin ranking (`limitedData` ok).

### Fuera de alcance
e2e; Standard 60; polish; features nuevas; rewrite scorers/EDHREC overlay “especial” para brawl.

## Criterio listo QA (post VoBo)
1. Solo commander|brawl100; cero path/custom size 60.
2. brawl100: pool legal no vacío + Moxfield invocado (o degrade); mazo 1+99; misma pipeline que commander.
3. Brew sin stub 403.
4. Regresión commander EDHREC.

## Estado
Diseño para **VoBo Luis**. QA/Dev idle hasta VoBo + rojo. Merge hold.
