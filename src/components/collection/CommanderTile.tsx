import { Bookmark, ExternalLink, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CollectionCard } from '@/services/collection/db';
import type { CommanderReadiness } from '@/services/collection/commanderReadiness';
import type { UserCardList } from '@/types';
import { useCommanderArt } from '@/hooks/useCommanderArt';
import { useStore } from '@/store';

/**
 * Navigate to /build/<name> with the "Build from Collection" toggle pre-enabled.
 * Used for both tile and spotlight Build buttons since the click always
 * originates from inside the user's collection context.
 */
function buildFromCollection(navigate: (path: string) => void, commanderName: string) {
  useStore.getState().updateCustomization({ collectionMode: true });
  navigate(`/build/${encodeURIComponent(commanderName)}`);
}

interface CommanderTileProps {
  commander: CollectionCard;
  readiness?: CommanderReadiness;
  /** True while the readiness is still being computed for this commander. */
  loading?: boolean;
  /** First saved deck the player has for this commander, if any. */
  savedDeck?: UserCardList;
}

/**
 * Map a readiness percent to a Tailwind gradient class for the bar.
 * Higher % = more saturated lavender (matches synergy palette).
 */
function readinessGradient(percent: number): string {
  if (percent >= 60) return 'from-violet-500 to-fuchsia-400';
  if (percent >= 40) return 'from-violet-500/80 to-violet-400/80';
  if (percent >= 20) return 'from-violet-500/60 to-violet-400/60';
  return 'from-violet-500/40 to-violet-400/40';
}

/** Adaptive tagline for the spotlight based on readiness. */
function readinessTag(percent: number): string {
  if (percent >= 60) return 'Ready to play';
  if (percent >= 40) return 'Almost there';
  return 'Getting started';
}

export function CommanderTile({ commander, readiness, loading, savedDeck }: CommanderTileProps) {
  const navigate = useNavigate();
  const percent = readiness?.percent ?? 0;
  const owned = readiness?.ownedCount ?? 0;
  const total = readiness?.totalCount ?? 0;

  const handleBuild = (e: React.MouseEvent) => {
    e.stopPropagation();
    buildFromCollection(navigate, commander.name);
  };

  const handleOpenSavedDeck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savedDeck) navigate(`/decks/${savedDeck.id}`);
  };

  return (
    <div className="group relative rounded-xl overflow-hidden bg-card/40 border border-border/40 hover:border-violet-400/40 transition-all">
      {/* Card image — full bleed, the frame already shows name + pips */}
      {commander.imageUrl ? (
        <img
          src={commander.imageUrl}
          alt={commander.name}
          className="w-full aspect-[5/7] object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-[5/7] bg-accent/50 flex items-center justify-center p-2">
          <span className="text-[10px] text-muted-foreground text-center leading-tight">{commander.name}</span>
        </div>
      )}

      {/* Saved-deck badge — top-left corner, clickable to jump to the deck */}
      {savedDeck && (
        <button
          type="button"
          onClick={handleOpenSavedDeck}
          title={`You have a saved deck: ${savedDeck.name}`}
          aria-label={`Open saved ${commander.name} deck`}
          className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/85 hover:bg-violet-400 text-white text-[10px] font-semibold shadow ring-1 ring-violet-300/40 transition-colors"
        >
          <Bookmark className="w-2.5 h-2.5" fill="currentColor" />
          Saved
        </button>
      )}

      {/* Slim bottom overlay — readiness bar + ratio + persistent Build button */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-2 py-2 pt-5 space-y-1">
        <div className="flex items-center justify-between gap-1.5 text-[10px] tabular-nums">
          {loading ? (
            <span className="inline-flex items-center gap-1 text-white/60">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              reading…
            </span>
          ) : total > 0 ? (
            <span className="text-violet-200/90">
              <span className="text-white font-semibold">{owned}</span>
              <span className="text-white/50">/{total}</span>
              <span className="text-white/50"> staples</span>
            </span>
          ) : (
            <span className="text-white/40">no data</span>
          )}
          <button
            type="button"
            onClick={handleBuild}
            title={`Generate a ${commander.name} deck`}
            aria-label={`Generate a ${commander.name} deck`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/80 hover:bg-violet-400 text-white transition-colors shadow"
          >
            <Wand2 className="w-3 h-3" />
          </button>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${readinessGradient(percent)} transition-all duration-700`}
            style={{ width: loading ? '0%' : `${Math.max(2, percent)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface CommanderSpotlightProps {
  commander: CollectionCard;
  readiness: CommanderReadiness;
  savedDeck?: UserCardList;
}

export function CommanderSpotlight({ commander, readiness, savedDeck }: CommanderSpotlightProps) {
  const navigate = useNavigate();
  const percent = Math.round(readiness.percent);
  const tag = readinessTag(readiness.percent);
  const artCrop = useCommanderArt(commander.name);
  const hasSavedDeck = !!savedDeck;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-violet-400/30 bg-gradient-to-br from-violet-950/40 via-card/60 to-fuchsia-950/30">
      {/* Backdrop — art crop, blurred and tinted */}
      {artCrop && (
        <div
          className="absolute inset-0 opacity-40 blur-md scale-110"
          style={{ backgroundImage: `url(${artCrop})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}
      {/* Color wash overlay to keep text readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/70 via-background/60 to-fuchsia-950/50" />

      <div className="relative grid grid-cols-[auto_1fr] gap-4 p-4 sm:gap-6 sm:p-6 items-center">
        {/* Art-crop hero — wide rectangle, not the card frame */}
        <div className="w-32 sm:w-44 aspect-[4/3] rounded-lg overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-violet-300/20 shrink-0">
          {artCrop ? (
            <img
              src={artCrop}
              alt={commander.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : commander.imageUrl ? (
            <img
              src={commander.imageUrl}
              alt={commander.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-accent/50" />
          )}
        </div>

        {/* Info column */}
        <div className="flex flex-col justify-center min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-violet-300/90 font-semibold">
            <Sparkles className="w-3 h-3" />
            {tag}
          </div>

          <h3 className="text-base sm:text-xl font-bold leading-tight">{commander.name}</h3>

          <div className="flex items-center gap-1.5 pt-0.5">
            {(commander.colorIdentity ?? []).length > 0 ? (
              (commander.colorIdentity ?? []).map(c => (
                <i key={c} className={`ms ms-${c.toLowerCase()} ms-cost text-sm`} />
              ))
            ) : (
              <i className="ms ms-c ms-cost text-sm" />
            )}
          </div>

          {/* Plain-language explainer — what the % actually measures */}
          <p className="text-xs text-muted-foreground/90 leading-snug pt-1 max-w-prose">
            You own{' '}
            <span className="text-foreground font-semibold">{readiness.ownedCount}</span>
            {' '}of the top{' '}
            <span className="text-foreground font-semibold">{readiness.totalCount}</span>
            {' '}most-played cards for this commander, per{' '}
            <a
              href={`https://edhrec.com/commanders/${encodeURIComponent(commander.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:underline"
            >
              EDHREC
            </a>
            .
          </p>

          {/* Readiness — % is the hero */}
          <div className="space-y-1 pt-1.5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                <span className="text-foreground font-semibold">{readiness.ownedCount}</span>
                <span className="text-muted-foreground">/{readiness.totalCount}</span>
              </span>
              <span className="text-3xl sm:text-4xl font-bold text-violet-200 tabular-nums leading-none">
                {percent}<span className="text-lg text-violet-300/70">%</span>
              </span>
            </div>
            <div className="h-2 bg-border/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${readinessGradient(readiness.percent)} transition-all duration-700`}
                style={{ width: `${Math.max(4, readiness.percent)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => buildFromCollection(navigate, commander.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white rounded-md transition-colors shadow-lg shadow-violet-900/40"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {hasSavedDeck ? 'Try another theme' : 'Generate deck'}
            </button>
            {hasSavedDeck && (
              <button
                type="button"
                onClick={() => navigate(`/decks/${savedDeck!.id}`)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-violet-200 hover:text-white bg-white/5 hover:bg-white/15 rounded-md transition-colors"
                title={`Open ${savedDeck!.name}`}
              >
                <Bookmark className="w-3 h-3" fill="currentColor" />
                View saved deck
                <ExternalLink className="w-3 h-3 opacity-70" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
