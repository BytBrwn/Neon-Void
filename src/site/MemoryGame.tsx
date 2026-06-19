import React, { useCallback, useEffect, useMemo, useState } from "react";

const SYMBOLS = ["⚡", "🎨", "🔗", "🛡️", "📊", "🚀", "🌟", "💎"] as const;

type Card = {
  id: string;
  symbol: (typeof SYMBOLS)[number];
  flipped: boolean;
  matched: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createDeck(): Card[] {
  const pairs = SYMBOLS.flatMap((symbol, index) => [
    { id: `${index}-a`, symbol, flipped: false, matched: false },
    { id: `${index}-b`, symbol, flipped: false, matched: false },
  ]);
  return shuffle(pairs);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const MemoryGame: React.FC = () => {
  const [cards, setCards] = useState<Card[]>(() => createDeck());
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);

  const matchedCount = useMemo(
    () => cards.filter((card) => card.matched).length,
    [cards],
  );
  const won = matchedCount === cards.length;

  useEffect(() => {
    if (!started || won) {
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, won]);

  const restart = useCallback(() => {
    setCards(createDeck());
    setPendingIndex(null);
    setMoves(0);
    setSeconds(0);
    setLocked(false);
    setStarted(false);
  }, []);

  const handleFlip = useCallback(
    (index: number) => {
      if (locked || won) {
        return;
      }

      const card = cards[index];
      if (card.flipped || card.matched) {
        return;
      }

      if (!started) {
        setStarted(true);
      }

      const nextCards = cards.map((item, i) =>
        i === index ? { ...item, flipped: true } : item,
      );
      setCards(nextCards);

      if (pendingIndex === null) {
        setPendingIndex(index);
        return;
      }

      if (pendingIndex === index) {
        return;
      }

      setMoves((value) => value + 1);
      setLocked(true);

      const first = cards[pendingIndex];
      const second = nextCards[index];
      const isMatch = first.symbol === second.symbol;

      window.setTimeout(() => {
        setCards((current) =>
          current.map((item, i) => {
            if (i !== pendingIndex && i !== index) {
              return item;
            }
            if (isMatch) {
              return { ...item, matched: true, flipped: true };
            }
            return { ...item, flipped: false };
          }),
        );
        setPendingIndex(null);
        setLocked(false);
      }, 700);
    },
    [cards, locked, pendingIndex, started, won],
  );

  return (
    <div className="panel-layout panel-layout--game memory-game">
      <div className="memory-game__sidebar">
        <p className="eyebrow">Play</p>
        <h2 className="section-title">Neon Match</h2>
        <p className="section-copy">
          Flip cards to find matching pairs. A tiny game built right into the
          widget — proof that Workshop panels can be fun too.
        </p>
        <div className="memory-game__stats">
          <div>
            <span>Moves</span>
            <strong>{moves}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{formatTime(seconds)}</strong>
          </div>
          <div>
            <span>Pairs</span>
            <strong>
              {matchedCount / 2}/{SYMBOLS.length}
            </strong>
          </div>
        </div>
        <button className="btn btn--ghost" type="button" onClick={restart}>
          New Game
        </button>
        {won && (
          <p className="memory-game__win" role="status">
            Cleared in {moves} moves · {formatTime(seconds)}
          </p>
        )}
      </div>

      <div className="memory-game__board" role="grid" aria-label="Memory match board">
        {cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            className={
              card.matched
                ? "memory-card memory-card--matched"
                : card.flipped
                  ? "memory-card memory-card--flipped"
                  : "memory-card"
            }
            aria-label={
              card.flipped || card.matched
                ? `Card showing ${card.symbol}`
                : "Hidden card"
            }
            disabled={locked || card.matched || card.flipped}
            onClick={() => handleFlip(index)}
          >
            <span className="memory-card__face memory-card__face--back" aria-hidden="true">
              ✦
            </span>
            <span className="memory-card__face memory-card__face--front" aria-hidden="true">
              {card.symbol}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
