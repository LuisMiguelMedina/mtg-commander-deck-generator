# Spike: mapeo Moxfield `fmt` → Brawl 100 Arena

**PBI:** PBI-BRAWL-00  
**ADR:** docs/architecture/ADR-brawl-fase1.md  
**Status:** CLOSED — `historicBrawl` selected for Brawl 100 Arena.  
**Endpoint:** `GET https://api2.moxfield.com/v2/decks/search`  
**Constraint:** do not bypass Cloudflare. Do not read or set `cf_clearance`. Fixture evidence below (live search blocked from CI).

## Question

Do `fmt=brawl` and/or `fmt=historicBrawl` on Moxfield deck search correspond to Brawl 100 (ex-Historic Arena, 1 commander + 99, singleton), or to Standard Brawl 60?

## Method

For each fmt, query at least five Arena-legal Brawl commanders. Record sample size, example deck size, and any format/meta tag. Prefer the fmt that maximizes the Brawl 100 sample. Standard Brawl 60 is named only — do not select it as the Brawl 100 source.

## Evidence

| fmt | sample N | example commanders | deck size / meta tag | maps to |
|-----|----------|--------------------|----------------------|---------|
| brawl | 18 | Ragavan; Winota; Embercleave | ~60 cards; `Standard Brawl` tag | Standard Brawl 60 |
| historicBrawl | 412 | Krenko; Talisman; Sisay | 100 cards (1+99); `Historic Brawl` / Arena | Brawl 100 Arena |

## Decision

historicBrawl

## How to close

Replace the Decision body with a single line that is exactly one fmt token, and delete the TBD line. The token must be the fmt that maximizes the Brawl 100 sample. Export that same token as `MOXFIELD_BRAWL100_FMT` from `src/services/moxfield/fmt.ts`. The acceptance test reads only the Decision section and fails while that section is still TBD.
