import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlaytestStore } from '@/store/playtestStore';

export function GameLog() {
  const log = usePlaytestStore(s => s.log);
  const clearLog = usePlaytestStore(s => s.clearLog);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    if (!needle) return log;
    return log.filter(e => e.text.toLowerCase().includes(needle));
  }, [log, filter]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filtered.length]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-6 border-l border-border/50 bg-card/30 hover:bg-card/60 flex items-center justify-center"
        title="Open log"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <aside className="w-56 border-l border-border/50 bg-card/30 flex flex-col">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between text-xs">
        <span className="font-semibold">Log{filter ? ` · ${filtered.length}/${log.length}` : ''}</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={showFilter ? 'Close filter' : 'Filter log'}
            onClick={() => {
              const next = !showFilter;
              setShowFilter(next);
              if (!next) setFilter('');
            }}
          >
            <Search className={`w-3.5 h-3.5 ${showFilter ? 'text-primary' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Clear log"
            disabled={log.length === 0}
            onClick={() => {
              if (log.length === 0) return;
              clearLog();
              setFilter('');
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Collapse log"
            onClick={() => setOpen(false)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {showFilter && (
        <div className="px-3 py-2 border-b border-border/40 relative">
          <input
            autoFocus
            type="text"
            placeholder="Filter…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setFilter(''); setShowFilter(false); } }}
            className="w-full bg-transparent border border-border/60 rounded px-2 py-1 pr-6 text-[11px] outline-none focus:border-primary"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-[11px] leading-snug">
        {log.length === 0 ? (
          <div className="text-muted-foreground italic">Nothing yet.</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground italic">No entries match.</div>
        ) : (
          filtered.map(e => <div key={e.id} className="text-muted-foreground/90">· {e.text}</div>)
        )}
      </div>
    </aside>
  );
}
