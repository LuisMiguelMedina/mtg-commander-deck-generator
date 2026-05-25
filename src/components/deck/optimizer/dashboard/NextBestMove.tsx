// src/components/deck/optimizer/dashboard/NextBestMove.tsx
import { Lightbulb, ArrowRight } from 'lucide-react';
import type { ScryfallCard, PlanScore, Misfit, GapAnalysisCard } from '@/types';
import type { RoleBreakdown, CurvePhaseAnalysis } from '@/services/deckBuilder/deckAnalyzer';
import type { TabKey } from '../constants';

export interface NextBestMoveProps {
  planScore?: PlanScore;
  misfits?: Misfit[];
  gapAnalysis?: GapAnalysisCard[];
  roleBreakdowns?: RoleBreakdown[];
  curvePhases?: CurvePhaseAnalysis[];
  /** Number of cards over deck target (positive = over, negative = under). */
  deckExcess: number;
  commander: ScryfallCard;
  onNavigate: (tab: TabKey) => void;
}

interface Suggestion {
  message: React.ReactNode;
  ctaLabel: string;
  navigateTo: TabKey;
}

function buildSuggestion(props: NextBestMoveProps): Suggestion | null {
  const { planScore, misfits, gapAnalysis, roleBreakdowns, curvePhases, deckExcess } = props;
  if (!planScore) return null;

  // Priority 1: over-target deck with at least one misfit → trim the misfit
  if (deckExcess > 0 && misfits && misfits.length > 0) {
    const worst = misfits[0];
    const replacement = worst.suggestedReplacement;
    return {
      message: (
        <>
          You're <strong>{deckExcess}</strong> over target. Start by trimming{' '}
          <strong className="text-rose-300">{worst.card.name}</strong>
          {replacement && (
            <> — consider swapping in <strong className="text-violet-300">{replacement.name}</strong> ({Math.round(replacement.inclusion)}% inclusion).</>
          )}
          {!replacement && <>.</>}
        </>
      ),
      ctaLabel: 'Review Card Fit',
      navigateTo: 'cardFit',
    };
  }

  // Priority 2: lowest non-partial sub-score, with area-specific suggestion
  type SubKey = 'strategy' | 'roles' | 'tempo' | 'cardFit';
  const order: SubKey[] = ['strategy', 'roles', 'tempo', 'cardFit'];
  let weakest: SubKey | null = null;
  let weakestValue = 101;
  for (const k of order) {
    const s = planScore.subscores[k];
    if (!s.partial && s.value < weakestValue) {
      weakest = k;
      weakestValue = s.value;
    }
  }

  // If all sub-scores are healthy (>= 85), no critical move
  if (weakest === null || weakestValue >= 85) return null;

  if (weakest === 'cardFit') {
    if (misfits && misfits.length > 0) {
      const worst = misfits[0];
      const replacement = worst.suggestedReplacement;
      return {
        message: (
          <>
            Card Fit is your weakest area. <strong className="text-rose-300">{worst.card.name}</strong> doesn't fit your plan
            {replacement && <> — consider <strong className="text-violet-300">{replacement.name}</strong> ({Math.round(replacement.inclusion)}% inclusion) instead</>}.
          </>
        ),
        ctaLabel: 'Review Card Fit',
        navigateTo: 'cardFit',
      };
    }
    if (gapAnalysis && gapAnalysis.length > 0) {
      const top = gapAnalysis[0];
      return {
        message: (
          <>
            Card Fit is your weakest area. Try adding <strong className="text-violet-300">{top.name}</strong> — played in {Math.round(top.inclusion)}% of decks for this commander.
          </>
        ),
        ctaLabel: 'See gaps',
        navigateTo: 'cardFit',
      };
    }
  }

  if (weakest === 'roles' && roleBreakdowns) {
    // Find role with lowest current/target ratio
    let worstRole: RoleBreakdown | null = null;
    let worstRatio = Infinity;
    for (const rb of roleBreakdowns) {
      const target = rb.target || 1;
      const ratio = rb.current / target;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstRole = rb;
      }
    }
    if (worstRole) {
      const deficit = Math.max(0, worstRole.target - worstRole.current);
      const sameRoleGap = gapAnalysis?.find(g => g.role === worstRole!.role);
      return {
        message: (
          <>
            Roles is your weakest area — light on <strong className="text-amber-300">{worstRole.label}</strong> ({worstRole.current} of {worstRole.target}{deficit > 0 ? `, ${deficit} short` : ''})
            {sameRoleGap && <>. Try <strong className="text-violet-300">{sameRoleGap.name}</strong> ({Math.round(sameRoleGap.inclusion)}% inclusion)</>}.
          </>
        ),
        ctaLabel: 'Open Roles',
        navigateTo: 'roles',
      };
    }
  }

  if (weakest === 'tempo' && curvePhases) {
    // Find weakest curve phase
    let worstPhase: CurvePhaseAnalysis | null = null;
    let worstRatio = Infinity;
    for (const phase of curvePhases) {
      const target = phase.target || 1;
      const ratio = phase.current / target;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstPhase = phase;
      }
    }
    if (worstPhase) {
      const deficit = Math.max(0, worstPhase.target - worstPhase.current);
      return {
        message: (
          <>
            Tempo is your weakest area — the <strong className="text-sky-300">{worstPhase.phase} game</strong> is light ({worstPhase.current} cards, target {worstPhase.target}{deficit > 0 ? `, ${deficit} short` : ''}).
          </>
        ),
        ctaLabel: 'Open Tempo',
        navigateTo: 'curve',
      };
    }
  }

  if (weakest === 'strategy') {
    // Suggest a high-synergy gap card
    const themeGap = gapAnalysis?.find(g => g.synergy > 0);
    if (themeGap) {
      return {
        message: (
          <>
            Strategy is your weakest area — consider adding <strong className="text-violet-300">{themeGap.name}</strong> (synergy +{themeGap.synergy.toFixed(2)}, played in {Math.round(themeGap.inclusion)}% of builds).
          </>
        ),
        ctaLabel: 'See gaps',
        navigateTo: 'cardFit',
      };
    }
  }

  return null;
}

export function NextBestMove(props: NextBestMoveProps) {
  const suggestion = buildSuggestion(props);
  if (!suggestion) return null;

  return (
    <button
      type="button"
      onClick={() => props.onNavigate(suggestion.navigateTo)}
      className="group relative w-full text-left rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-4 hover:border-violet-500/60 hover:bg-violet-500/10 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-1.5 rounded-md bg-violet-500/20 text-violet-300">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-violet-300/80 mb-1">
            Try this first
          </div>
          <p className="text-sm text-foreground/95 leading-relaxed">{suggestion.message}</p>
        </div>
        <div className="shrink-0 self-center flex items-center text-xs text-violet-300/80 group-hover:text-violet-200 transition-colors">
          {suggestion.ctaLabel} <ArrowRight className="w-3 h-3 ml-1" />
        </div>
      </div>
    </button>
  );
}
