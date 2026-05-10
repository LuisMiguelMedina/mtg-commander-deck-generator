import React, { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { usePlaytestStore } from '@/store/playtestStore';
import { usePlaytestSettings, BG_STYLES } from '@/store/playtestSettingsStore';
import { BattlefieldCard } from '@/components/playtest/BattlefieldCard';
import { FreeCounter } from '@/components/playtest/FreeCounter';
import { BattlefieldContextMenu, type BattlefieldMenuTarget } from '@/components/playtest/BattlefieldContextMenu';

const BF_CARD_W = 100;
const BF_CARD_H = 140;

export function Battlefield() {
  const cards = usePlaytestStore(s => s.battlefield);
  const freeCounters = usePlaytestStore(s => s.freeCounters);
  const setRect = usePlaytestStore(s => s.setBattlefieldRect);
  const addFreeCounter = usePlaytestStore(s => s.addFreeCounter);
  const setSelectedIds = usePlaytestStore(s => s.setSelectedIds);
  const clearSelection = usePlaytestStore(s => s.clearSelection);
  const bg = usePlaytestSettings(s => s.bg);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<BattlefieldMenuTarget | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Track size for arrival snap
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect(r.width, r.height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setRect]);

  const { setNodeRef, isOver } = useDroppable({ id: 'battlefield', data: { kind: 'battlefield' } });
  const composedRef = (node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  };

  // Render parents first, attached children after parents (z-order)
  const sorted = [...cards].sort((a, b) => {
    if (!a.attachedTo && b.attachedTo) return -1;
    if (a.attachedTo && !b.attachedTo) return 1;
    return 0;
  });

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only fire when right-clicking the empty battlefield, not a card / counter.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      bfX: e.clientX - rect.left,
      bfY: e.clientY - rect.top,
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return; // only on empty battlefield
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startX = x;
    const startY = y;
    let movedFar = false;

    const containerEl = e.currentTarget;
    containerEl.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      if (!movedFar && Math.hypot(cx - startX, cy - startY) > 3) movedFar = true;
      if (movedFar) {
        setMarquee({ x0: startX, y0: startY, x1: cx, y1: cy });
      }
    };
    const onUp = (ev: PointerEvent) => {
      containerEl.removeEventListener('pointermove', onMove);
      containerEl.removeEventListener('pointerup', onUp);
      containerEl.removeEventListener('pointercancel', onUp);
      try { containerEl.releasePointerCapture(ev.pointerId); } catch { /* noop */ }

      if (!movedFar) {
        // Plain click on empty battlefield → clear selection.
        clearSelection();
        setMarquee(null);
        return;
      }

      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const l = Math.min(startX, cx);
      const r = Math.max(startX, cx);
      const t = Math.min(startY, cy);
      const b = Math.max(startY, cy);
      const hits: string[] = [];
      for (const c of cardsRef.current) {
        const cl = c.x;
        const ct = c.y;
        const cr = cl + BF_CARD_W;
        const cb = ct + BF_CARD_H;
        if (l < cr && r > cl && t < cb && b > ct) hits.push(c.instanceId);
      }
      setSelectedIds(hits);
      setMarquee(null);
    };
    containerEl.addEventListener('pointermove', onMove);
    containerEl.addEventListener('pointerup', onUp);
    containerEl.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={composedRef}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      className={`flex-1 relative border-b border-border/50 overflow-hidden ${isOver ? 'ring-2 ring-primary/40 ring-inset' : ''}`}
      style={{ background: BG_STYLES[bg].background }}
    >
      {sorted.map(b => <BattlefieldCard key={b.instanceId} card={b} />)}
      {freeCounters.map(c => <FreeCounter key={c.id} counter={c} />)}
      {marquee && (
        <div
          className="absolute pointer-events-none border border-primary/80 bg-primary/15"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
            zIndex: 65,
          }}
        />
      )}
      <BattlefieldContextMenu
        target={menu}
        onClose={() => setMenu(null)}
        onAddCounter={(color, position) => addFreeCounter(color, position)}
      />
    </div>
  );
}
