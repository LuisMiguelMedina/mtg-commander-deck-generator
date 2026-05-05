import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { usePlaytestStore } from '@/store/playtestStore';
import { getCardImageUrl } from '@/services/scryfall/client';
import type { ZoneKey } from '@/components/playtest/types';

const ZONE_LABEL: Record<string, string> = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile', command: 'Command Zone' };

export function ZoneViewerModal() {
  const modal = usePlaytestStore(s => s.modal);
  const zones = usePlaytestStore(s => s.zones);
  const closeModal = usePlaytestStore(s => s.closeModal);
  const moveCard = usePlaytestStore(s => s.moveCard);
  const [q, setQ] = useState('');

  if (!modal || modal.kind !== 'zoneViewer') return null;
  const zone = modal.zone;
  const cards = zones[zone];

  // Keep original indices alongside filtered cards so move actions still target the real position.
  const filtered = useMemo(() => {
    const indexed = cards.map((card, originalIndex) => ({ card, originalIndex }));
    const needle = q.toLowerCase().trim();
    if (!needle) return indexed;
    return indexed.filter(({ card }) =>
      card.name.toLowerCase().includes(needle) ||
      card.type_line.toLowerCase().includes(needle),
    );
  }, [cards, q]);

  const moveTo = (idx: number, target: 'hand' | 'graveyard' | 'exile' | 'command' | 'libtop' | 'libbot') => {
    const source: { kind: 'zone'; zone: Exclude<ZoneKey, 'hand'>; index: number } = { kind: 'zone', zone, index: idx };
    if (target === 'libtop') moveCard({ source, target: { kind: 'library', position: 'top' } });
    else if (target === 'libbot') moveCard({ source, target: { kind: 'library', position: 'bottom' } });
    else moveCard({ source, target: { kind: 'zone', zone: target } });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={closeModal}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/60">
          <h2 className="text-base font-semibold">
            {ZONE_LABEL[zone]} <span className="text-muted-foreground font-normal">({filtered.length}{filtered.length !== cards.length ? ` of ${cards.length}` : ''})</span>
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeModal}><X className="w-4 h-4" /></Button>
        </div>
        <div className="px-5 py-3 border-b border-border/40">
          <Input
            autoFocus
            placeholder="Search by name or type…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground italic text-center py-8">
              {cards.length === 0 ? 'Empty.' : 'No cards match the filter.'}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
              {filtered.map(({ card, originalIndex }) => (
                <Popover key={`${card.id}-${originalIndex}`}>
                  <PopoverTrigger asChild>
                    <button className="rounded-[5px] hover:ring-2 hover:ring-primary transition-all">
                      <img src={getCardImageUrl(card, 'small')} alt={card.name} className="w-full rounded-[5px] shadow" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1">
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'hand')}>To Hand</Button>
                    {zone !== 'library' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'libtop')}>To Library Top</Button>}
                    {zone !== 'library' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'libbot')}>To Library Bottom</Button>}
                    {zone !== 'graveyard' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'graveyard')}>To Graveyard</Button>}
                    {zone !== 'exile' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'exile')}>To Exile</Button>}
                    {zone !== 'command' && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => moveTo(originalIndex, 'command')}>To Command Zone</Button>}
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
