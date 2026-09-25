import { useMemo } from 'react';
import { useStore } from '@/store';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  brawlArenaWildcardLimitRows,
  countArenaWildcardsNeeded,
  formatArenaWildcardNeedSummary,
} from '@/lib/format/arenaWildcards';
import type { ScryfallCard } from '@/types';

function deckCardsForWildcardCount(
  generatedDeck: ReturnType<typeof useStore.getState>['generatedDeck'],
  commander: ScryfallCard | null,
  partner: ScryfallCard | null,
): Array<{ name: string; rarity?: string }> {
  const out: Array<{ name: string; rarity?: string }> = [];
  if (commander) out.push({ name: commander.name, rarity: commander.rarity });
  if (partner) out.push({ name: partner.name, rarity: partner.rarity });
  if (!generatedDeck) return out;
  for (const card of Object.values(generatedDeck.categories).flat()) {
    out.push({ name: card.name, rarity: card.rarity });
  }
  return out;
}

export function ArenaWildcardLimitsPanel({ ownedNames }: { ownedNames?: Set<string> }) {
  const { generatedDeck, commander, partnerCommander } = useStore();
  const rows = brawlArenaWildcardLimitRows();

  const needSummary = useMemo(() => {
    const cards = deckCardsForWildcardCount(generatedDeck, commander, partnerCommander);
    if (cards.length === 0) return null;
    const counts = countArenaWildcardsNeeded(cards, ownedNames);
    return formatArenaWildcardNeedSummary(counts);
  }, [generatedDeck, commander, partnerCommander, ownedNames]);

  return (
    <div className="mt-3 space-y-4 px-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Historic Brawl is digital on MTG Arena — there is no paper budget. Each missing card is
        crafted with one wildcard of the same rarity (singleton: at most one wildcard per card).
      </p>
      <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-muted/30 text-muted-foreground font-medium">
          <span>Rarity</span>
          <span>Wildcard cost</span>
          <span>Brawl limit</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.rarity}
            className="grid grid-cols-3 gap-2 px-3 py-2 border-t border-border/40 text-foreground/90"
          >
            <span>{row.label}</span>
            <span>{row.wildcardLabel}</span>
            <span className="text-muted-foreground">{row.perCardLimit}</span>
          </div>
        ))}
      </div>
      {needSummary ? (
        <p className="text-xs text-violet-200/90">
          Wildcards to craft this list{ownedNames ? ' (cards not in your collection)' : ''}:{' '}
          <span className="font-medium">{needSummary}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/80">
          Generate a deck to see an estimated wildcard breakdown by rarity.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
        <InfoTooltip text="Arena lets you upgrade wildcards (e.g. 4 Common → 1 Uncommon). Each crafted card still consumes one wildcard of that card's rarity tier." />
        <span>Upgrade paths exist in Arena, but each crafted card uses one wildcard of its rarity.</span>
      </p>
    </div>
  );
}
