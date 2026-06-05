import { CollectionImporter } from '@/components/collection/CollectionImporter';
import { CollectionManager } from '@/components/collection/CollectionManager';
import { CollectionStats } from '@/components/collection/CollectionStats';
import { AuroraThemed } from '@/components/ui/AuroraThemed';
import { useCollection } from '@/hooks/useCollection';
import { getAuroraColors } from '@/lib/commanderTheme';
import { ArrowLeft, ChevronDown, Info } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CollectionPage() {
  const navigate = useNavigate();
  const { count, cards, isLoading } = useCollection();
  const [importOpen, setImportOpen] = useState(false);
  const [didInitOpen, setDidInitOpen] = useState(false);
  const [filterColors, setFilterColors] = useState<string[]>([]);

  useEffect(() => {
    if (didInitOpen || isLoading) return;
    setImportOpen(count === 0);
    setDidInitOpen(true);
  }, [didInitOpen, isLoading, count]);

  const handleFilterColorsChange = useCallback((codes: string[]) => {
    setFilterColors(codes);
  }, []);

  const auroraColors = useMemo(() => getAuroraColors(filterColors), [filterColors]);

  return (
    <>
      <AuroraThemed colors={auroraColors} />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-bold">My Collection</h2>
          <p className="text-sm text-muted-foreground">
            Import your MTG card collection, then enable "Build from Collection" when generating decks
            to only use cards you own.
          </p>
        </div>

        <aside className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm w-full max-w-xs space-y-3 mb-6 lg:mb-0 lg:absolute lg:top-24 lg:right-4 lg:z-30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4 text-muted-foreground" />
            Good to know
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your collection is stored locally in your browser and may be cleared if you clear site data.
            We recommend using a dedicated inventory manager as your source of truth and re-importing here as needed.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href="https://www.moxfield.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Moxfield</a>
            <span className="text-border">·</span>
            <a href="https://www.archidekt.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Archidekt</a>
            <span className="text-border">·</span>
            <a href="https://deckbox.org" target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Deckbox</a>
            <span className="text-border">·</span>
            <a href="https://www.manabox.app" target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Manabox</a>
          </div>
        </aside>

        <div className="space-y-8">
          {/* Import Section */}
          <section className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm max-w-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setImportOpen(o => !o)}
              aria-expanded={importOpen}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/30 transition-colors"
            >
              <span>Import Collection</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${importOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {importOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-border/40">
                <CollectionImporter hideLabel />
              </div>
            )}
          </section>

          {/* Collection Stats */}
          {count > 0 && <CollectionStats cards={cards} />}

          {/* Collection List */}
          {count > 0 && (
            <section className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <CollectionManager onSelectedColorsChange={handleFilterColorsChange} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
