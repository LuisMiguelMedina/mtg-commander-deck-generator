import { describe, expect, it, vi, afterEach } from 'vitest';
import { suggestionsFor } from '@/services/foundry/commanderSuggestions';
import * as scryfallClient from '@/services/scryfall/client';

describe('Brawl commander suggestions batching (unit test)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('batches card lookups using getCardsByNames instead of firing parallel getCardByName calls', async () => {
    const mockCards = new Map<string, any>([
      ['Ral, Crackling Wit', { name: 'Ral, Crackling Wit', color_identity: ['U', 'R'] }],
      ['Kinnan, Bonder Prodigy', { name: 'Kinnan, Bonder Prodigy', color_identity: ['G', 'U'] }],
    ]);

    const getCardsByNamesSpy = vi
      .spyOn(scryfallClient, 'getCardsByNames')
      .mockResolvedValue(mockCards as any);

    const result = await suggestionsFor({
      formatMode: 'brawl100',
      colorFilter: [],
      fetchEdhrecTop: async () => [],
      fetchMoxfieldTop: async () => ({
        status: 200,
        source: 'archidekt',
        names: ['Ral, Crackling Wit', 'Kinnan, Bonder Prodigy'],
      }),
      fetchScryfallTopBrawl: async () => ({ names: [], colorIdentityByName: {} }),
      flagEnabled: true,
    });

    expect(result.source).toBe('archidekt');
    expect(result.names).toEqual(['Ral, Crackling Wit', 'Kinnan, Bonder Prodigy']);
    expect(getCardsByNamesSpy).toHaveBeenCalledTimes(1);
    expect(getCardsByNamesSpy).toHaveBeenCalledWith(['Ral, Crackling Wit', 'Kinnan, Bonder Prodigy']);
    expect(result.colorIdentityByName).toEqual({
      'Ral, Crackling Wit': ['U', 'R'],
      'Kinnan, Bonder Prodigy': ['G', 'U'],
    });
  });

  it('filters by color identity correctly when a color filter is active', async () => {
    const mockCards = new Map<string, any>([
      ['Ral, Crackling Wit', { name: 'Ral, Crackling Wit', color_identity: ['U', 'R'] }],
      ['Kinnan, Bonder Prodigy', { name: 'Kinnan, Bonder Prodigy', color_identity: ['G', 'U'] }],
    ]);

    vi.spyOn(scryfallClient, 'getCardsByNames').mockResolvedValue(mockCards as any);

    const result = await suggestionsFor({
      formatMode: 'brawl100',
      colorFilter: ['U', 'R'],
      fetchEdhrecTop: async () => [],
      fetchMoxfieldTop: async () => ({
        status: 200,
        source: 'archidekt',
        names: ['Ral, Crackling Wit', 'Kinnan, Bonder Prodigy'],
      }),
      fetchScryfallTopBrawl: async () => ({ names: [], colorIdentityByName: {} }),
      flagEnabled: true,
    });

    expect(result.names).toEqual(['Ral, Crackling Wit']);
    expect(result.colorIdentityByName?.['Ral, Crackling Wit']).toEqual(['U', 'R']);
  });
});
