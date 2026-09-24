import { useStore } from '@/store';
import type { FormatMode } from '@/lib/format/formatMode';
import { clearCommanderSuggestionsCache } from '@/services/foundry/commanderSuggestions';

type LandingOption = { label: string; mode: FormatMode };
export type FoundryLandingModel = {
  step1?: { options?: LandingOption[]; heading?: string };
  step2Available?: boolean;
  formatMode?: string | null;
};

export function foundryLandingModel(state?: { formatMode?: string | null }): FoundryLandingModel {
  const formatMode = state?.formatMode ?? null;
  return {
    step1: {
      heading: 'Choose format',
      options: [
        { label: 'Historic Brawl', mode: 'brawl100' },
        { label: 'Commander', mode: 'commander' },
      ],
    },
    step2Available: formatMode === 'commander' || formatMode === 'brawl100',
    formatMode,
  };
}

export function setLandingFormatMode(mode: string): void {
  const store = useStore.getState();
  const next = mode === 'brawl100' ? 'brawl100' : 'commander';
  if (store.customization.formatMode !== next) {
    store.setCommander(null);
    clearCommanderSuggestionsCache();
  }
  store.updateCustomization({ formatMode: next });
}
