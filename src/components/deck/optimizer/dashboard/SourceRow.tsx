// src/components/deck/optimizer/dashboard/SourceRow.tsx
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Pencil, Bookmark, ExternalLink } from 'lucide-react';
import { ColorIdentity } from '@/components/ui/mtg-icons';
import type { ScryfallCard } from '@/types';
import { getCardImageUrl } from '@/services/scryfall/client';
import type { ReactNode } from 'react';

export interface SourceRowProps {
  commander: ScryfallCard;
  partnerCommander?: ScryfallCard;
  colorIdentity?: string[];
  sourceLabel: string;
  /** Display text for the detected plan, e.g. "+1/+1 Counters". null when none detected. */
  planName?: string | null;
  /** Adjust popover content (themes, tempo, deck size, land target). */
  adjustContent?: ReactNode;
  onSaveAsDeck?: () => void;
  onOpenInDeckView?: () => void;
}

export function SourceRow({
  commander, partnerCommander, colorIdentity,
  sourceLabel, planName, adjustContent,
  onSaveAsDeck, onOpenInDeckView,
}: SourceRowProps) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-border/30">
      <img
        src={getCardImageUrl(commander, 'small') ?? ''}
        alt={commander.name}
        className="w-10 h-14 rounded border border-border/40 object-cover shrink-0"
      />
      {partnerCommander && (
        <img
          src={getCardImageUrl(partnerCommander, 'small') ?? ''}
          alt={partnerCommander.name}
          className="w-10 h-14 rounded border border-border/40 object-cover shrink-0 -ml-6"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">
          {commander.name}
          {partnerCommander && <span className="text-muted-foreground"> + {partnerCommander.name}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{sourceLabel}</span>
          {planName && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                Detected plan:
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-semibold text-[10px]">
                  {planName}
                </span>
              </span>
            </>
          )}
        </div>
        {colorIdentity && colorIdentity.length > 0 && (
          <div className="mt-1"><ColorIdentity colors={colorIdentity} size="sm" /></div>
        )}
      </div>
      {adjustContent && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adjust plan</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-80 p-0">
            {adjustContent}
          </PopoverContent>
        </Popover>
      )}
      {onOpenInDeckView ? (
        <Button size="sm" variant="outline" onClick={onOpenInDeckView}>
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Deck view</span>
        </Button>
      ) : onSaveAsDeck ? (
        <Button size="sm" variant="outline" onClick={onSaveAsDeck}>
          <Bookmark className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Save as deck</span>
        </Button>
      ) : null}
    </div>
  );
}
