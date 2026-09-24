import { getFormatRules, type FormatMode } from '@/lib/format/formatMode';
import { useStore } from '@/store';

export type FormatModeOption = {
  mode: FormatMode;
  label: string;
  selectable: boolean;
};

/** Pure model for acceptance tests and UI — commander and brawl100 only. */
export function formatModeSelectorModel() {
  const brawlRules = getFormatRules('brawl100');
  return {
    options: [
      { mode: 'commander' as const, label: 'Commander', selectable: true },
      { mode: 'brawl100' as const, label: 'Brawl 100', selectable: true },
    ],
    brawl100LifeCopy: brawlRules?.lifeCopy,
  };
}

export function FormatModeSelector() {
  const { customization, updateCustomization } = useStore();
  const formatMode = customization.formatMode ?? 'commander';
  const model = formatModeSelectorModel();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium block">Format</label>
      <div className="grid grid-cols-2 gap-2">
        {model.options.map((option) => (
          <button
            key={option.mode}
            type="button"
            disabled={!option.selectable}
            onClick={() => option.selectable && updateCustomization({ formatMode: option.mode })}
            className={`p-3 rounded-lg border text-center transition-colors ${
              formatMode === option.mode
                ? 'border-primary bg-primary/10 text-violet-200'
                : option.selectable
                  ? 'border-border hover:border-primary/50'
                  : 'border-border opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="font-medium text-sm">{option.label}</div>
            {option.mode === 'brawl100' && model.brawl100LifeCopy && (
              <div className="text-xs text-muted-foreground mt-1">{model.brawl100LifeCopy}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
