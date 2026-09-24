# PBI-BRAWL-03 — PopularityProvider + Moxfield (flag ON, degradación)

**VoBo Luis:** Moxfield api2 search; flag ON por defecto; degradar a Scryfall/DeckDataSource si falla; ≤1 rps + Dexie; sin bypass CF. Rate proyecto ≤10% PM.

## User story
Como builder en Brawl 100, quiero popularidad de mazos públicos Moxfield cuando esté disponible, y un fallback claro si Moxfield falla.

## Acceptance criteria (GWT)
1. **Given** FormatMode `brawl100` y flag Moxfield ON (default)  
   **When** hay respuesta OK de search  
   **Then** PopularityProvider expone inclusión normalizada (al menos inclusion % o conteo + sample/numDecks) usando el fmt del spike (PBI-00)

2. **Given** Moxfield responde 403 / Cloudflare / timeout / 5xx  
   **When** se solicita popularidad  
   **Then** se degrada a `DeckDataSource: 'scryfall'` (o equivalente existente) sin lanzar bypass CF

3. **Given** el cliente Moxfield  
   **When** encola requests  
   **Then** respeta ≤1 rps, retry/backoff en 429/5xx, timeout, User-Agent estable

4. **Given** una respuesta exitosa  
   **When** se cachea  
   **Then** usa Dexie (store `moxfieldResponses` o `externalResponses`) con TTL documentado

5. **Given** FormatMode `commander`  
   **When** se pide popularidad  
   **Then** sigue EDHREC (sin romper)

6. **Given** sample insuficiente para un comandante  
   **When** se muestran datos  
   **Then** umbral mínimo → fallback Scryfall y señal de “datos limitados” (contrato/test)

## SyRS atómicos
- SYRS-B3-01: Puerto `PopularityProvider` con implementaciones commander=EDHREC, brawl100=Moxfield.
- SYRS-B3-02: Feature flag default ON; test del default.
- SYRS-B3-03: Path de degradación testeable (mock 403 → scryfall).
- SYRS-B3-04: Rate limiter ≤1 rps testeable (fake timers / cola).
- SYRS-B3-05: Prohibido código que lea/setee `cf_clearance` o automatice bypass CF (test estático o ausencia de símbolo).

## Fuera de alcance
Email a support Moxfield; Standard Brawl 60; backfill masivo en CI.
