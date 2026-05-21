// src/components/analyze/AnalyzeSplit.tsx
import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface AnalyzeSplitProps {
  analyzer: ReactNode;
  deck: ReactNode;
}

export function AnalyzeSplit({ analyzer, deck }: AnalyzeSplitProps) {
  return (
    <>
      <div className="lg:hidden">
        {deck}
        {analyzer}
      </div>

      <div className="hidden lg:block h-[calc(100vh-180px)] px-2 sm:px-3 lg:px-4">
        <PanelGroup
          direction="horizontal"
          autoSaveId="analyze-split"
          className="h-full"
        >
          <Panel defaultSize={55} minSize={30} className="overflow-y-auto pr-2">
            {analyzer}
          </Panel>
          <PanelResizeHandle className="group relative w-2 flex items-center justify-center cursor-col-resize">
            <span
              aria-hidden
              className="block h-full w-px bg-border/40 transition-colors group-hover:bg-violet-400/60 group-data-[resize-handle-active]:bg-violet-400/60"
            />
          </PanelResizeHandle>
          <Panel defaultSize={45} minSize={30} className="overflow-y-auto pl-2">
            {deck}
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
