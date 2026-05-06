import { useEffect, useState } from 'react';

let pressed = false;
const listeners = new Set<(v: boolean) => void>();
let initialized = false;

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const set = (v: boolean) => {
    if (pressed === v) return;
    pressed = v;
    listeners.forEach(l => l(v));
  };
  window.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    set(true);
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') set(false); });
  window.addEventListener('blur', () => set(false));
}

export function useMagnifyKey(): boolean {
  ensureInit();
  const [v, setV] = useState(pressed);
  useEffect(() => {
    listeners.add(setV);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
