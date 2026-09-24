# PBI-BRAWL-00 — Spike: mapeo Moxfield `fmt` → Brawl 100 Arena

**Puerta técnica (Arquitectura):** validar antes de features de popularidad.  
**ADR:** ADR-brawl-fase1.md  
**Repo:** LuisMiguelMedina/mtg-commander-deck-generator

## User story
Como equipo, quiero saber si `fmt=brawl` y/o `fmt=historicBrawl` en Moxfield search corresponden a Brawl 100 (ex-Historic Arena, 1+99), para etiquetar la fuente y no mezclar Standard Brawl 60.

## Acceptance criteria (GWT)
1. **Given** la API pública de search Moxfield  
   **When** se consulta con `fmt=brawl` y con `fmt=historicBrawl` (muestra N≥5 comandantes Arena-legal Brawl)  
   **Then** queda documentado cuál(es) fmt alimentan Brawl 100 Arena vs 60-card, con evidencia (conteos, ejemplos de deck size / meta tag)

2. **Given** el resultado del spike  
   **When** se define el cliente Moxfield  
   **Then** el `sourceTag` / fmt usado queda fijado en contrato (constante exportada + test)

3. **Given** ambigüedad o ambos fmt válidos  
   **When** se elige el mapeo  
   **Then** hay decisión escrita (preferir el que maximice sample Brawl 100) y test que fija esa decisión

## SyRS atómicos
- SYRS-B0-01: Artefacto `docs/spikes/moxfield-fmt-brawl100.md` con tabla fmt → formato.
- SYRS-B0-02: Constante/contrato `MOXFIELD_BRAWL100_FMT` (o equivalente) alineada al spike.
- SYRS-B0-03: Test de aceptación que falla hasta que el contrato exista y coincida con el spike documentado.
- SYRS-B0-04: Prohibido bypass Cloudflare; si search no es observable en CI, el test usa fixture del spike + contrato, no live scrape en CI.

## Fuera de alcance
Implementación green del cliente completo; Standard Brawl 60.
