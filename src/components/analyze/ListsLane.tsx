import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserLists } from '@/hooks/useUserLists';
import { ColorIdentity } from '@/components/ui/mtg-icons';
import type { UserCardList } from '@/types';

interface ListsLaneProps {
  onPick: (list: UserCardList) => void;
  loading: boolean;
  loadingListId: string | null;
}

export function ListsLane({ onPick, loading, loadingListId }: ListsLaneProps) {
  const { lists } = useUserLists();
  const eligible = useMemo(
    () => lists.filter(l => !!l.commanderName).sort((a, b) => b.updatedAt - a.updatedAt),
    [lists],
  );

  if (eligible.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No saved decks yet. Paste a deck above, or{' '}
        <Link to="/lists" className="text-primary hover:underline">
          build one
        </Link>{' '}
        and come back.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {eligible.map(list => {
        const isLoading = loading && loadingListId === list.id;
        return (
          <button
            key={list.id}
            onClick={() => onPick(list)}
            disabled={loading}
            className={`flex items-center gap-3 text-left rounded-lg border border-border/50 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors p-2.5 ${
              loading && !isLoading ? 'opacity-50' : ''
            }`}
          >
            <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted/30">
              {list.cachedCommanderArtUrl ? (
                <img
                  src={list.cachedCommanderArtUrl}
                  alt={list.commanderName}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{list.name}</p>
              <p className="text-xs text-muted-foreground truncate">{list.commanderName}</p>
              {list.cachedColorIdentity && list.cachedColorIdentity.length > 0 && (
                <div className="mt-1">
                  <ColorIdentity colors={list.cachedColorIdentity} size="sm" />
                </div>
              )}
            </div>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
