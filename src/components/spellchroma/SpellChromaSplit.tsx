import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

/**
 * SpellChroma workbench split: the deck playmat on the left, the explorer on
 * the right, with a draggable divider (ratio persisted via autoSaveId).
 * Default ~40/60 (explorer-focused). Stacks vertically below lg.
 */
export function SpellChromaSplit({ deck, explorer }: { deck: ReactNode; explorer: ReactNode }) {
  return (
    <>
      <div className="lg:hidden flex flex-col gap-4">
        {deck}
        {explorer}
      </div>

      <div className="hidden lg:block h-[calc(100vh-77px)]">
        <PanelGroup direction="horizontal" autoSaveId="spellchroma-split" className="h-full">
          <Panel defaultSize={40} minSize={25} className="overflow-hidden">
            <div className="h-full min-h-0 flex flex-col">{deck}</div>
          </Panel>
          <PanelResizeHandle className="group relative flex items-center justify-center cursor-col-resize px-1.5">
            <span aria-hidden className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border/40 transition-colors group-hover:bg-violet-400/60 group-data-[resize-handle-active]:bg-violet-400/60" />
            <span aria-hidden className="relative flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/70" />
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/70" />
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/70" />
            </span>
          </PanelResizeHandle>
          <Panel defaultSize={60} minSize={30} className="overflow-hidden">
            <div className="h-full min-h-0 flex flex-col overflow-y-auto">{explorer}</div>
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
