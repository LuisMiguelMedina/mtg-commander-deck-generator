import { useEffect, useState } from 'react';

/**
 * Aurora background with a faint fade-out → swap → fade-in when the color
 * pair changes. The aurora-bg's pseudo-elements interpolate the gradient
 * via CSS vars; the outer wrapper handles the opacity choreography so the
 * color swap happens at the bottom of the dip, not abruptly.
 */
export function AuroraThemed({ colors }: { colors: { a: string; b: string } }) {
  const FADE_MS = 320;
  const [displayed, setDisplayed] = useState(colors);
  const [phase, setPhase] = useState<'idle' | 'fading-out' | 'fading-in'>('idle');

  useEffect(() => {
    if (colors.a === displayed.a && colors.b === displayed.b) return;
    setPhase('fading-out');
    const swap = setTimeout(() => {
      setDisplayed(colors);
      setPhase('fading-in');
    }, FADE_MS);
    return () => clearTimeout(swap);
  }, [colors.a, colors.b, displayed.a, displayed.b]);

  useEffect(() => {
    if (phase !== 'fading-in') return;
    const settle = setTimeout(() => setPhase('idle'), FADE_MS);
    return () => clearTimeout(settle);
  }, [phase]);

  return (
    <div
      className="aurora-themed"
      style={{
        '--aurora-color-a': displayed.a,
        '--aurora-color-b': displayed.b,
        opacity: phase === 'fading-out' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      } as React.CSSProperties}
    >
      <div className="aurora-bg" />
    </div>
  );
}
