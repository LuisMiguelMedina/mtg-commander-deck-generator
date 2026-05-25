// src/components/deck/optimizer/dashboard/HowThisDeckWins.tsx
import type { LucideIcon } from 'lucide-react';
import { Trophy, Sword, Zap, Crosshair, Shield, Sparkles } from 'lucide-react';
import type { ScryfallCard, DetectedCombo } from '@/types';
import { getCardRole } from '@/services/tagger/client';

export interface HowThisDeckWinsProps {
  commander: ScryfallCard;
  partnerCommander?: ScryfallCard;
  cards: ScryfallCard[];
  detectedCombos?: DetectedCombo[];
  planName?: string | null;
  /** Number of cards with isGameChanger=true in deck. */
  gameChangerCount?: number;
}

type WinVector = 'combo' | 'spellslinger' | 'tokens' | 'voltron' | 'control' | 'combat';

interface WinPath {
  icon: LucideIcon;
  label: string;
  detail: string;
}

function isCreatureCard(card: ScryfallCard): boolean {
  return card.type_line?.toLowerCase().includes('creature') ?? false;
}

function detectVector(
  commander: ScryfallCard,
  cards: ScryfallCard[],
  detectedCombos: DetectedCombo[],
  planName: string | null | undefined,
): WinVector {
  // 1. combo — any complete combo
  if (detectedCombos.some(c => c.isComplete)) return 'combo';

  const nonLands = cards.filter(c => !c.type_line?.toLowerCase().includes('land'));
  const instants = nonLands.filter(c => c.type_line?.toLowerCase().startsWith('instant')).length;
  const sorceries = nonLands.filter(c => c.type_line?.toLowerCase().startsWith('sorcery')).length;
  const creatures = nonLands.filter(c => isCreatureCard(c)).length;
  const spellCount = instants + sorceries;

  // 2. spellslinger
  if (spellCount > creatures && spellCount >= 25) return 'spellslinger';

  // 3. tokens
  const tokenProducers = nonLands.filter(c =>
    /create.+token/i.test(c.oracle_text ?? '')
  ).length;
  if (tokenProducers >= 8) return 'tokens';

  // 4. voltron — commander is a creature AND (5+ equipment/auras OR theme hint)
  const commanderIsCreature = isCreatureCard(commander);
  if (commanderIsCreature) {
    const equipAura = nonLands.filter(c => {
      const tl = c.type_line?.toLowerCase() ?? '';
      return tl.includes('equipment') || tl.includes('aura');
    }).length;
    const themeHint = planName ? /counter|voltron|equipment|aura|buff/i.test(planName) : false;
    if (equipAura >= 5 || themeHint) return 'voltron';
  }

  // 5. control
  const interactionCount = nonLands.filter(c => {
    const role = getCardRole(c.name);
    if (role === 'removal' || role === 'boardwipe') return true;
    // Fallback oracle-text check if tagger data is not loaded
    return /destroy target|exile target|counter target/i.test(c.oracle_text ?? '');
  }).length;
  if (creatures < 18 && interactionCount >= 15) return 'control';

  // 6. combat — default
  return 'combat';
}

function buildNarrative(
  vector: WinVector,
  commander: ScryfallCard,
  detectedCombos: DetectedCombo[],
): string {
  switch (vector) {
    case 'combo': {
      const firstCombo = detectedCombos.find(c => c.isComplete);
      const firstComboLabel = firstCombo?.results[0] ?? 'Combo';
      return `Combo win — ${firstComboLabel}. Your deck has a one-shot kill on the table.`;
    }
    case 'spellslinger':
      return 'Spellslinger — damage and disruption from the stack.';
    case 'tokens':
      return 'Go wide — tokens swarm and swing for lethal.';
    case 'voltron':
      return `Voltron — buff and swing ${commander.name}.`;
    case 'control':
      return 'Attrition — out-resource opponents over time.';
    case 'combat':
      return `Combat damage via ${commander.name}.`;
  }
}

function buildPaths(
  vector: WinVector,
  commander: ScryfallCard,
  cards: ScryfallCard[],
  detectedCombos: DetectedCombo[],
  gameChangerCount: number,
): WinPath[] {
  const nonLands = cards.filter(c => !c.type_line?.toLowerCase().includes('land'));
  const paths: WinPath[] = [];

  // 1. Voltron path — vector=voltron OR commander is creature
  if (vector === 'voltron' || isCreatureCard(commander)) {
    const protectionCount = nonLands.filter(c =>
      /hexproof|indestructible|shroud|protection from|ward/i.test(c.oracle_text ?? '')
    ).length;
    const evasionCount = nonLands.filter(c =>
      /flying|trample|menace|unblockable|can't be blocked/i.test(c.oracle_text ?? '')
    ).length;
    if (protectionCount > 0 || evasionCount > 0) {
      paths.push({
        icon: Shield,
        label: 'Voltron swing',
        detail: `${protectionCount} protection · ${evasionCount} evasion`,
      });
    }
  }

  // 2. Tokens path — vector=tokens
  if (vector === 'tokens') {
    const tokenProducers = nonLands.filter(c =>
      /create.+token/i.test(c.oracle_text ?? '')
    ).length;
    const anthems = nonLands.filter(c =>
      /creatures you control (get|gain)|other creatures (get|gain).*\+\d\/\+\d|all creatures get/i.test(c.oracle_text ?? '')
    ).length;
    paths.push({
      icon: Crosshair,
      label: 'Token swarm',
      detail: `${tokenProducers} token producers · ${anthems} anthems`,
    });
  }

  // 3. Spellslinger path — vector=spellslinger
  if (vector === 'spellslinger') {
    const instants = nonLands.filter(c => c.type_line?.toLowerCase().startsWith('instant')).length;
    const sorceries = nonLands.filter(c => c.type_line?.toLowerCase().startsWith('sorcery')).length;
    paths.push({
      icon: Sparkles,
      label: 'Stack pressure',
      detail: `${instants + sorceries} spells across instants and sorceries`,
    });
  }

  // 4. Control path — vector=control
  if (vector === 'control') {
    const interactionCount = nonLands.filter(c => {
      const role = getCardRole(c.name);
      if (role === 'removal' || role === 'boardwipe') return true;
      return /destroy target|exile target|counter target/i.test(c.oracle_text ?? '');
    }).length;
    paths.push({
      icon: Shield,
      label: 'Disruption',
      detail: `${interactionCount} interaction pieces`,
    });
  }

  // 5. Complete combo paths (max 2)
  const completeCombos = detectedCombos.filter(c => c.isComplete).slice(0, 2);
  for (const combo of completeCombos) {
    const resultLabel = combo.results[0] ?? 'Infinite combo';
    const pieces = combo.cards.slice(0, 3).join(' · ');
    paths.push({
      icon: Zap,
      label: 'Combo',
      detail: `${resultLabel} — pieces: ${pieces}`,
    });
  }

  // 6. Near-miss combo paths (max 2)
  const nearMissCombos = detectedCombos.filter(c => !c.isComplete && c.missingCards.length === 1).slice(0, 2);
  for (const combo of nearMissCombos) {
    const resultLabel = combo.results[0] ?? 'Infinite combo';
    paths.push({
      icon: Zap,
      label: 'Near miss',
      detail: `${resultLabel} — 1 card away (${combo.missingCards[0]})`,
    });
  }

  // 7. Notable threats path
  if (gameChangerCount > 0) {
    const gcCards = cards
      .filter(c => c.isGameChanger === true)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 3);
    if (gcCards.length > 0) {
      paths.push({
        icon: Crosshair,
        label: 'Notable threats',
        detail: gcCards.map(c => c.name).join(' · '),
      });
    }
  }

  // Fallback combat path if no paths generated
  if (paths.length === 0) {
    const creatureCount = nonLands.filter(c => isCreatureCard(c)).length;
    paths.push({
      icon: Sword,
      label: 'Combat',
      detail: `${creatureCount} creatures available to swing`,
    });
  }

  return paths.slice(0, 4);
}

export function HowThisDeckWins({
  commander,
  partnerCommander: _partnerCommander,
  cards,
  detectedCombos = [],
  planName,
  gameChangerCount = 0,
}: HowThisDeckWinsProps) {
  if (cards.length === 0) return null;

  const vector = detectVector(commander, cards, detectedCombos, planName);
  const narrative = buildNarrative(vector, commander, detectedCombos);
  const paths = buildPaths(vector, commander, cards, detectedCombos, gameChangerCount);

  return (
    <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 text-amber-300/80" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
          How this deck wins
        </span>
      </div>
      <p className="text-sm text-foreground/95 leading-relaxed">{narrative}</p>
      {paths.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {paths.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                <Icon className="w-3.5 h-3.5 mt-0.5 text-violet-300/80 shrink-0" />
                <div className="flex-1 min-w-0 leading-snug">
                  <span className="font-semibold text-foreground/95">{p.label}</span>
                  <span className="text-muted-foreground/70"> · {p.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
