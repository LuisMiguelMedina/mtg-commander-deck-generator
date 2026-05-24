// src/services/deckBuilder/cardFit.ts
import type {
  ScryfallCard,
  EDHRECCommanderData,
  GapAnalysisCard,
  Misfit,
  MisfitReason,
} from '@/types';
import type { ThemeMembership } from '@/components/analyze/themeMembership';
import { ROLE_LABELS } from './roleTargets';
import { getCardRole } from '../tagger/client';
import { isAnyLand } from '../scryfall/client';

const INCLUSION_LOW = 5;       // %
const SYNERGY_LOW = 0;          // EDHREC synergy ≤ 0
const MISFIT_REASON_THRESHOLD = 2; // need ≥ 2 reasons to flag as misfit

export interface MisfitInputs {
  /** Cards currently in the deck (excluding commander). */
  cards: ScryfallCard[];
  /** Per-card EDHREC inclusion % for cards in the deck. */
  cardInclusionMap: Record<string, number>;
  /** Per-card EDHREC synergy. Optional. */
  cardSynergyMap?: Record<string, number>;
  /** Theme membership for active themes. */
  themeMembership: ThemeMembership | null;
  /** Gap candidates (top EDHREC cards not in deck) — used for replacement suggestion. */
  gapCandidates?: GapAnalysisCard[];
  /** EDHREC commander payload (for citing decklist count). */
  commanderData?: EDHRECCommanderData | null;
}

export function computeMisfits(inputs: MisfitInputs): Misfit[] {
  const {
    cards,
    cardInclusionMap,
    cardSynergyMap,
    themeMembership,
    gapCandidates,
  } = inputs;

  const misfits: Misfit[] = [];
  const themeByCard = themeMembership?.byCard;

  for (const card of cards) {
    if (isAnyLand(card)) continue; // lands evaluated separately, not as misfits here

    const reasons: MisfitReason[] = [];

    const incl = cardInclusionMap[card.name];
    if (incl != null && incl < INCLUSION_LOW) {
      reasons.push({
        label: 'Low inclusion',
        detail: `Plays in ${incl.toFixed(0)}% of decklists for this commander`,
      });
    }

    const syn = cardSynergyMap?.[card.name];
    if (syn != null && syn <= SYNERGY_LOW) {
      reasons.push({
        label: 'No synergy',
        detail: `EDHREC synergy ${syn >= 0 ? '+' : ''}${syn.toFixed(2)} for this commander`,
      });
    }

    const role = getCardRole(card.name);
    if (!role) {
      reasons.push({ label: 'No role', detail: 'No tagger role (ramp / removal / draw / wipe)' });
    }

    const themed = themeByCard?.has(card.name.toLowerCase());
    if (themeByCard && themeByCard.size > 0 && !themed) {
      reasons.push({ label: 'Off theme', detail: 'Not in your detected theme bucket' });
    }

    if (reasons.length >= MISFIT_REASON_THRESHOLD) {
      const misfitScore =
        (reasons.length * 10) +
        (incl != null ? Math.max(0, INCLUSION_LOW - incl) : 0) +
        (syn != null ? Math.max(0, -syn * 5) : 0);
      const suggestedReplacement = pickReplacement(card, role, gapCandidates);
      misfits.push({ card, misfitScore, reasons, suggestedReplacement });
    }
  }

  // Highest misfitScore first.
  misfits.sort((a, b) => b.misfitScore - a.misfitScore);
  return misfits;
}

function pickReplacement(
  card: ScryfallCard,
  role: string | null,
  gapCandidates?: GapAnalysisCard[],
): GapAnalysisCard | undefined {
  if (!gapCandidates || gapCandidates.length === 0) return undefined;
  // Prefer a same-role gap candidate first; otherwise the strongest overall.
  if (role) {
    const sameRole = gapCandidates.find(g => g.role === role);
    if (sameRole) return sameRole;
  }
  // Match same primary type as a softer fallback (e.g. Creature → Creature).
  const cardType = (card.type_line ?? '').split('—')[0].trim();
  const sameType = gapCandidates.find(g => g.typeLine.startsWith(cardType.split(' ')[0]));
  return sameType ?? gapCandidates[0];
}

export function computeCardFitSubscore(misfits: Misfit[], gapCount: number) {
  // Inverse: more misfits + fewer gaps filled = worse score.
  const misfitPenalty = Math.min(40, misfits.length * 8);
  const gapPenalty = Math.min(20, gapCount * 1.5);
  const value = Math.max(0, 100 - misfitPenalty - gapPenalty);
  const surface = misfits.length === 0 && gapCount === 0
    ? 'Every card pulls its weight.'
    : `${misfits.length} misfit${misfits.length === 1 ? '' : 's'} · ${gapCount} high-value gap${gapCount === 1 ? '' : 's'}`;
  return { value, surface, bandLabel: bandForCardFit(value) };
}

function bandForCardFit(score: number): string {
  if (score >= 90) return 'Tight';
  if (score >= 75) return 'Healthy';
  if (score >= 60) return 'Solid';
  if (score >= 40) return 'Loose';
  return 'Bloated';
}

export { ROLE_LABELS };
