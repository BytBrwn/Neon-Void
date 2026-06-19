import React, { useEffect, useRef, useState } from "react";

type Fragment = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
};

type HealthBarProps = {
  health: number;
  maxHealth: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export const HealthBar: React.FC<HealthBarProps> = ({ health, maxHealth }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const prevHealthRef = useRef(health);
  const healthRef = useRef(health);
  const maxHealthRef = useRef(maxHealth);
  const displayRef = useRef(health / maxHealth);
  const idRef = useRef(0);
  const [displayRatio, setDisplayRatio] = useState(health / maxHealth);
  const [fragments, setFragments] = useState<Fragment[]>([]);

  healthRef.current = health;
  maxHealthRef.current = maxHealth;

  useEffect(() => {
    displayRef.current = healthRef.current / maxHealth;
    setDisplayRatio(displayRef.current);
  }, [maxHealth]);

  useEffect(() => {
    const prev = prevHealthRef.current;
    const bar = barRef.current;
    if (health < prev - 0.5 && bar) {
      const barWidth = bar.clientWidth;
      const oldRatio = prev / maxHealth;
      const newRatio = health / maxHealth;
      const lostStart = barWidth * newRatio;
      const lostEnd = barWidth * oldRatio;
      const span = Math.max(8, lostEnd - lostStart);
      const damage = prev - health;
      const count = Math.min(16, Math.max(4, Math.floor(damage / 3)));
      const hue = 120 * (health / maxHealth);
      const spawned: Fragment[] = [];

      for (let i = 0; i < count; i += 1) {
        spawned.push({
          id: idRef.current++,
          x: lostStart + Math.random() * span,
          y: rand(-2, 4),
          vx: rand(30, 140),
          vy: rand(-50, 30),
          rot: rand(0, 360),
          vr: rand(-420, 420),
          life: rand(0.45, 0.95),
          maxLife: 0.95,
          size: rand(3, 8),
          hue,
        });
      }
      setFragments((current) => [...current, ...spawned]);
    }
    prevHealthRef.current = health;
  }, [health, maxHealth]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number): void => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      const target = healthRef.current / maxHealthRef.current;
      const next = displayRef.current + (target - displayRef.current) * Math.min(1, dt * 12);
      displayRef.current = Math.abs(target - next) < 0.001 ? target : next;
      setDisplayRatio(displayRef.current);

      setFragments((current) =>
        current
          .map((fragment) => ({
            ...fragment,
            x: fragment.x + fragment.vx * dt,
            y: fragment.y + fragment.vy * dt,
            vy: fragment.vy + 220 * dt,
            vx: fragment.vx * 0.985,
            rot: fragment.rot + fragment.vr * dt,
            life: fragment.life - dt,
          }))
          .filter((fragment) => fragment.life > 0),
      );

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const fillHue = 120 * displayRatio;

  return (
    <div className="neon-game__health-dock">
      <div className="neon-game__health-meta">
        <span className="neon-game__health-label">Hull integrity</span>
        <span className="neon-game__health-value">
          {Math.ceil(health)} / {maxHealth}
        </span>
      </div>
      <div className="neon-game__health-track" ref={barRef}>
        <div
          className="neon-game__health-fill"
          style={{
            width: `${displayRatio * 100}%`,
            background: `linear-gradient(90deg, hsl(${fillHue}, 90%, 52%), hsl(${fillHue + 40}, 85%, 58%))`,
            boxShadow: `0 0 14px hsla(${fillHue}, 90%, 55%, 0.5)`,
          }}
        />
        <div
          className="neon-game__health-fill neon-game__health-fill--ghost"
          style={{ width: `${Math.min(1, displayRatio + 0.04) * 100}%`, opacity: 0.25 }}
          aria-hidden
        />
        {fragments.map((fragment) => (
          <span
            key={fragment.id}
            className="neon-game__health-fragment"
            style={{
              left: `${fragment.x}px`,
              top: `${fragment.y}px`,
              width: `${fragment.size}px`,
              height: `${fragment.size}px`,
              opacity: fragment.life / fragment.maxLife,
              transform: `rotate(${fragment.rot}deg)`,
              background: `hsl(${fragment.hue + 20}, 92%, ${52 + (fragment.life / fragment.maxLife) * 18}%)`,
              boxShadow: `0 0 6px hsla(${fragment.hue}, 90%, 60%, ${fragment.life / fragment.maxLife})`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
