import { describe, expect, it } from 'vitest';
import spikeMarkdown from '../../../../docs/spikes/moxfield-fmt-brawl100.md?raw';
import { tryLoadSeam } from '@/test/loadSeam';

/**
 * PBI-BRAWL-00 acceptance (red until the spike is closed and Dev exports the fmt).
 * docs/pbi/PBI-BRAWL-00-spike-fmt-mapping.md
 * docs/spikes/moxfield-fmt-brawl100.md
 *
 * Intended seam: `MOXFIELD_BRAWL100_FMT` from `src/services/moxfield/fmt.ts`.
 * The Decision section of the spike is TBD on purpose, so this file stays red
 * even after a constant exists, until that section names the same token.
 */

const FMT_MODULE = '@/services/moxfield/fmt';
const FMT_CHOICES = ['brawl', 'historicBrawl'] as const;

function decisionBody(markdown: string): string {
  const after = markdown.split(/^## Decision\s*$/m)[1] ?? '';
  return after.split(/^## /m)[0] ?? '';
}

/** Closed spike: Decision body is exactly one fmt token and does not say TBD. */
function spikeDecisionFmt(markdown: string): 'brawl' | 'historicBrawl' | null {
  const lines = decisionBody(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.some((line) => /^TBD\b/i.test(line))) return null;
  const hits = lines.filter((line) => line === 'brawl' || line === 'historicBrawl');
  if (hits.length !== 1) return null;
  return hits[0] as 'brawl' | 'historicBrawl';
}

function evidenceRows(markdown: string): Array<Record<string, string>> {
  const section = (markdown.split(/^## Evidence\s*$/m)[1] ?? '').split(/^## /m)[0] ?? '';
  const lines = section.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase());
  return lines.slice(2).map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

describe('PBI-BRAWL-00 Moxfield fmt → Brawl 100', () => {
  const markdown = spikeMarkdown;

  it('exports MOXFIELD_BRAWL100_FMT as brawl or historicBrawl and matches the spike Decision', async () => {
    const mod = await tryLoadSeam(FMT_MODULE);
    const fmt = mod?.MOXFIELD_BRAWL100_FMT;
    const decision = spikeDecisionFmt(markdown);

    expect(FMT_CHOICES, `${FMT_MODULE} MOXFIELD_BRAWL100_FMT`).toContain(fmt);
    expect(FMT_CHOICES, 'docs/spikes/moxfield-fmt-brawl100.md ## Decision').toContain(decision);
    expect(fmt).toBe(decision);
  });

  it('documents exactly one fmt row mapping to Brawl 100 Arena (not 60-card)', () => {
    const rows = evidenceRows(markdown);
    const brawl100 = rows.filter((row) => /^Brawl 100\b/.test(row['maps to'] ?? ''));

    expect(brawl100, 'Evidence table maps to').toHaveLength(1);
    expect(FMT_CHOICES).toContain(brawl100[0]?.fmt);
    expect(brawl100[0]?.['maps to']).not.toMatch(/60/);
  });
});
