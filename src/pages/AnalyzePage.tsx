import { useState, useEffect } from 'react';
import { LaneTabs, type LaneKey } from '@/components/analyze/LaneTabs';
import { WhatYoullSeeStrip } from '@/components/analyze/WhatYoullSeeStrip';

const LANE_STORAGE_KEY = 'analyze-active-lane';

export function AnalyzePage() {
  const [activeLane, setActiveLane] = useState<LaneKey>(() => {
    const stored = localStorage.getItem(LANE_STORAGE_KEY);
    if (stored === 'paste' || stored === 'lists' || stored === 'generate') return stored;
    return 'paste';
  });

  useEffect(() => {
    localStorage.setItem(LANE_STORAGE_KEY, activeLane);
  }, [activeLane]);

  return (
    <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8">
      <div className="text-center py-6 max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-4xl font-bold mb-3">
          Analyze any{' '}
          <span className="gradient-text">Commander deck</span>
        </h2>
        <p className="text-base text-muted-foreground">
          See what's strong, what's missing, and why.
        </p>
      </div>

      <LaneTabs active={activeLane} onChange={setActiveLane} />

      <div
        id={`lane-panel-${activeLane}`}
        role="tabpanel"
        aria-labelledby={`lane-tab-${activeLane}`}
        className="max-w-3xl mx-auto rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-6 min-h-[280px]"
      >
        <p className="text-sm text-muted-foreground text-center py-10">
          {activeLane === 'paste' && 'Paste lane (coming in Task 3)'}
          {activeLane === 'lists' && 'My Lists lane (coming in Task 4)'}
          {activeLane === 'generate' && 'Generate lane (coming in Task 5)'}
        </p>
      </div>

      <WhatYoullSeeStrip />
    </main>
  );
}
