import { useMemo, useState } from 'react';
import { ClipboardPaste, Layers, ListChecks, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserLists } from '@/hooks/useUserLists';
import { getCardsByNames } from '@/services/scryfall/client';
import { ColorIdentity } from '@/components/ui/mtg-icons';
import { parseDecklist } from './DeckInput';
import type { ScryfallCard, UserCardList } from '@/types';

type Lane = 'paste' | 'decks' | 'lists';

// Confident, common oracle-tag slugs for the "jump straight in" chips.
const STARTER_TAGS = ['ramp', 'removal', 'card-advantage', 'counterspell', 'tutor', 'lifegain', 'sacrifice-outlet', 'draw'];

const TABS: { key: Lane; label: string; icon: typeof ClipboardPaste }[] = [
  { key: 'paste', label: 'Paste',      icon: ClipboardPaste },
  { key: 'decks', label: 'Your Decks', icon: Layers },
  { key: 'lists', label: 'Your Lists', icon: ListChecks },
];

interface SpellChromaLandingProps {
  onLoad: (cards: ScryfallCard[]) => void;
  onExplore: () => void;
  onStarterTag: (slug: string) => void;
}

export function SpellChromaLanding({ onLoad, onExplore, onStarterTag }: SpellChromaLandingProps) {
  const { lists } = useUserLists();
  const [lane, setLane] = useState<Lane>('paste');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Decks = commander decks or anything explicitly typed 'deck'. Lists = the rest.
  const decks = useMemo(
    () => lists.filter(l => l.cards.length > 0 && (l.type === 'deck' || !!l.commanderName)).sort((a, b) => b.updatedAt - a.updatedAt),
    [lists],
  );
  const plainLists = useMemo(
    () => lists.filter(l => l.cards.length > 0 && l.type !== 'deck' && !l.commanderName).sort((a, b) => b.updatedAt - a.updatedAt),
    [lists],
  );

  const resolve = async (names: string[], id?: string) => {
    if (names.length === 0) return;
    setBusy(true);
    if (id) setLoadingId(id);
    try {
      const map = await getCardsByNames(names);
      const cards = names.map(n => map.get(n)).filter((c): c is ScryfallCard => !!c);
      if (cards.length > 0) onLoad(cards);
    } finally {
      setBusy(false);
      setLoadingId(null);
    }
  };

  return (
    <main className="relative px-4 py-8">
      <div className="text-center py-6 max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-4xl font-bold mb-3">
          Explore by what a card <span className="gradient-text">does</span>
        </h2>
        <p className="text-base text-muted-foreground">
          Load a deck to see its tags — or just start hunting cards by tag.
        </p>
      </div>

      {/* Lane tabs */}
      <div role="tablist" aria-label="Choose how to load a deck" className="flex items-center gap-1.5 justify-center mb-6">
        {TABS.map(tab => {
          const active = lane === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setLane(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 border ${
                active
                  ? 'bg-primary/20 text-violet-200 border-primary/50'
                  : 'bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-3 sm:p-6 min-h-[260px]">
        {lane === 'paste' && (
          <div className="flex flex-col gap-3">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder={'Paste a decklist…\n\n1 Sol Ring\n1 Cultivate\nBeast Within'}
              className="w-full text-sm rounded-md bg-background border border-border/60 p-3 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <Button className="self-end" disabled={busy || text.trim() === ''} onClick={() => resolve(parseDecklist(text))}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Loading…</> : 'Load deck'}
            </Button>
          </div>
        )}
        {lane === 'decks' && (
          <PickGrid lists={decks} emptyLabel="No saved decks yet. Paste one, or build a deck and come back." busy={busy} loadingId={loadingId} onPick={l => resolve(l.cards, l.id)} />
        )}
        {lane === 'lists' && (
          <PickGrid lists={plainLists} emptyLabel="No saved lists yet." busy={busy} loadingId={loadingId} onPick={l => resolve(l.cards, l.id)} />
        )}
      </div>

      {/* Jump-straight-in escape — preserves SpellChroma's tag-first browsing */}
      <div className="max-w-3xl mx-auto mt-6 text-center">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-border/40" />
          <span className="text-xs text-muted-foreground">or jump straight in</span>
          <div className="flex-1 h-px bg-border/40" />
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {STARTER_TAGS.map(slug => (
            <button
              key={slug}
              onClick={() => onStarterTag(slug)}
              className="px-2.5 py-1 rounded-full text-xs bg-violet-500/12 text-violet-200 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
            >
              {slug}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onExplore} className="gap-1.5 text-muted-foreground">
          <Compass className="w-4 h-4" />
          Explore without a deck
        </Button>
      </div>
    </main>
  );
}

function PickGrid({ lists, emptyLabel, busy, loadingId, onPick }: {
  lists: UserCardList[];
  emptyLabel: string;
  busy: boolean;
  loadingId: string | null;
  onPick: (l: UserCardList) => void;
}) {
  if (lists.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {lists.map(list => {
        const isLoading = busy && loadingId === list.id;
        return (
          <button
            key={list.id}
            onClick={() => onPick(list)}
            disabled={busy}
            className={`relative overflow-hidden flex items-center gap-3 min-w-0 text-left rounded-lg border border-border/50 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors p-2.5 ${busy && !isLoading ? 'opacity-50' : ''}`}
          >
            {list.cachedCommanderArtUrl && (
              <div className="absolute inset-0 pointer-events-none">
                <img src={list.cachedCommanderArtUrl} alt="" className="w-full h-full object-cover opacity-[0.18]" />
                <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-card/60 to-card/80" />
              </div>
            )}
            <div className="relative flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{list.name}</p>
              <p className="text-xs text-muted-foreground truncate">{list.commanderName ?? `${list.cards.length} cards`}</p>
              {list.cachedColorIdentity && list.cachedColorIdentity.length > 0 && (
                <div className="mt-1"><ColorIdentity colors={list.cachedColorIdentity} size="sm" /></div>
              )}
            </div>
            {isLoading && <Loader2 className="relative w-4 h-4 animate-spin text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
