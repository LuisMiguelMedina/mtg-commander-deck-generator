import type { ScryfallCard } from '@/types';

const STOP: Record<string, string> = {
  W: '#fcd34d',
  U: '#3b82f6',
  B: '#a78bfa',  // soft violet — pure black reads as dead pixels behind blur
  R: '#ef4444',
  G: '#22c55e',
};

const COLORLESS = '#94a3b8';

export interface ManaColors {
  /** Primary CSS hex for the aurora wash and mana ring. */
  primary: string;
  /** Secondary CSS hex (for two-color blends); falls back to primary. */
  secondary: string;
  /** rgba glow string at given alpha. */
  glow(alpha: number): string;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

export function manaColorsFor(card: ScryfallCard): ManaColors {
  const ci = card.color_identity ?? [];
  const stops = ci.map(c => STOP[c]).filter(Boolean);
  const primary = stops[0] ?? COLORLESS;
  const secondary = stops[1] ?? primary;
  return {
    primary,
    secondary,
    glow(alpha: number) {
      const [r, g, b] = hexToRgb(primary);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
  };
}
