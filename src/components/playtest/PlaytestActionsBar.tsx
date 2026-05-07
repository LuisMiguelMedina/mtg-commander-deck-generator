import { useState } from 'react';
import { Hand as HandIcon, Shuffle, RotateCcw, Search, Eye, Sparkles, Plus, Settings as SettingsIcon, Undo2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { usePlaytestStore } from '@/store/playtestStore';
import { PlaytestSettingsModal } from '@/components/playtest/PlaytestSettingsModal';

export function PlaytestActionsBar() {
  const draw = usePlaytestStore(s => s.draw);
  const untapAll = usePlaytestStore(s => s.untapAll);
  const shuffle = usePlaytestStore(s => s.shuffle);
  const beginMulligan = usePlaytestStore(s => s.beginMulligan);
  const undo = usePlaytestStore(s => s.undo);
  const reset = usePlaytestStore(s => s.reset);
  const openModal = usePlaytestStore(s => s.openModal);
  const historyLen = usePlaytestStore(s => s.history.length);

  const [scryN, setScryN] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur px-4 py-1.5 flex items-center gap-1.5 flex-wrap justify-center">
      <Button variant="outline" size="sm" onClick={() => draw(1)} title="Draw a card (D)"><Plus className="w-3.5 h-3.5 mr-1" />Draw</Button>
      <Button variant="outline" size="sm" onClick={untapAll} title="Untap all (U)"><RotateCcw className="w-3.5 h-3.5 mr-1" />Untap</Button>
      <Button variant="outline" size="sm" onClick={shuffle} title="Shuffle library (S)"><Shuffle className="w-3.5 h-3.5 mr-1" />Shuffle</Button>
      <Button variant="outline" size="sm" onClick={beginMulligan} title="Mulligan (M)"><HandIcon className="w-3.5 h-3.5 mr-1" />Mulligan</Button>
      <Button variant="outline" size="sm" onClick={() => openModal({ kind: 'search' })} title="Search library"><Search className="w-3.5 h-3.5 mr-1" />Search</Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" title="Scry, Mill, or Surveil"><Eye className="w-3.5 h-3.5 mr-1" />Scry/Mill/Surveil</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs">N:</span>
            <input type="number" min={1} max={20} value={scryN} onChange={e => setScryN(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-12 bg-transparent border border-border/50 rounded px-1 py-0.5 text-xs" />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => openModal({ kind: 'scry', n: scryN })}>Scry {scryN}</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => openModal({ kind: 'mill', n: scryN })}>Mill {scryN}</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => openModal({ kind: 'surveil', n: scryN })}>Surveil {scryN}</Button>
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" onClick={() => openModal({ kind: 'tokens' })} title="Create token"><Sparkles className="w-3.5 h-3.5 mr-1" />Tokens</Button>
      <Button variant="ghost" size="sm" disabled={historyLen === 0} onClick={undo} title="Undo last action (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5 mr-1" />Undo</Button>
      <Button variant="ghost" size="sm" onClick={reset} title="Reset playtest"><RefreshCw className="w-3.5 h-3.5 mr-1" />Reset</Button>
      <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Playtest settings">
        <SettingsIcon className="w-4 h-4" />
      </Button>
      <PlaytestSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
