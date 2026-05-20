import type { ScryfallCard } from '@/types';

interface StacksColumnProps {
  cards: { card: ScryfallCard; quantity: number }[];
  renderTile: (card: ScryfallCard, quantity: number) => React.ReactNode;
  offset?: number;
}

export function StacksColumn({ cards, renderTile, offset = 36 }: StacksColumnProps) {
  if (cards.length === 0) return null;
  const lastIndex = cards.length - 1;
  return (
    <div
      className="relative w-full"
      style={{ paddingTop: `calc(${lastIndex} * ${offset}px + 140%)` }}
    >
      {cards.map((entry, i) => (
        <div
          key={entry.card.id}
          className="absolute left-0 right-0 transition-transform duration-150 hover:-translate-y-1 hover:z-20"
          style={{ top: i * offset, zIndex: i }}
        >
          {renderTile(entry.card, entry.quantity)}
        </div>
      ))}
    </div>
  );
}
