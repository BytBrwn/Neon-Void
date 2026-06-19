import React, { useEffect, useRef } from "react";

type Fragment = {
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
  el: HTMLSpanElement;
};

type HealthBarProps = {
  health: number;
  maxHealth: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function paintFill(fill: HTMLDivElement, ratio: number): void {
  const hue = 120 * ratio;
  fill.style.width = `${ratio * 100}%`;
  fill.style.background = `linear-gradient(90deg, hsl(${hue}, 90%, 52%), hsl(${hue + 40}, 85%, 58%))`;
  fill.style.boxShadow = `0 0 14px hsla(${hue}, 90%, 55%, 0.5)`;
}

export const HealthBar: React.FC<HealthBarProps> = ({ health, maxHealth }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const fragmentLayerRef = useRef<HTMLDivElement>(null);
  const prevHealthRef = useRef(health);
  const healthRef = useRef(health);
  const maxHealthRef = useRef(maxHealth);
  const displayRef = useRef(health / maxHealth);
  const fragmentsRef = useRef<Fragment[]>([]);

  healthRef.current = health;
  maxHealthRef.current = maxHealth;

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    displayRef.current = healthRef.current / maxHealthRef.current;
    paintFill(fill, displayRef.current);
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.width = `${Math.min(1, displayRef.current + 0.04) * 100}%`;
    }
  }, [maxHealth]);

  useEffect(() => {
    const prev = prevHealthRef.current;
    const bar = barRef.current;
    const layer = fragmentLayerRef.current;
    if (health < prev - 0.5 && bar && layer) {
      const barWidth = bar.clientWidth;
      const oldRatio = prev / maxHealth;
      const newRatio = health / maxHealth;
      const lostStart = barWidth * newRatio;
      const lostEnd = barWidth * oldRatio;
      const span = Math.max(8, lostEnd - lostStart);
      const damage = prev - health;
      const count = Math.min(16, Math.max(4, Math.floor(damage / 3)));
      const hue = 120 * (health / maxHealth);

      for (let i = 0; i < count; i += 1) {
        const el = document.createElement("span");
        el.className = "neon-game__health-fragment";
        layer.appendChild(el);
        fragmentsRef.current.push({
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
          el,
        });
      }
    }
    prevHealthRef.current = health;
  }, [health, maxHealth]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let running = true;

    const tick = (now: number): void => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      const target = healthRef.current / maxHealthRef.current;
      const next = displayRef.current + (target - displayRef.current) * Math.min(1, dt * 12);
      displayRef.current = Math.abs(target - next) < 0.001 ? target : next;

      const fill = fillRef.current;
      const ghost = ghostRef.current;
      if (fill) paintFill(fill, displayRef.current);
      if (ghost) ghost.style.width = `${Math.min(1, displayRef.current + 0.04) * 100}%`;

      const frags = fragmentsRef.current;
      let write = 0;
      for (let i = 0; i < frags.length; i += 1) {
        const fragment = frags[i];
        fragment.x += fragment.vx * dt;
        fragment.y += fragment.vy * dt;
        fragment.vy += 220 * dt;
        fragment.vx *= 0.985;
        fragment.rot += fragment.vr * dt;
        fragment.life -= dt;
        if (fragment.life > 0) {
          const alpha = fragment.life / fragment.maxLife;
          fragment.el.style.left = `${fragment.x}px`;
          fragment.el.style.top = `${fragment.y}px`;
          fragment.el.style.width = `${fragment.size}px`;
          fragment.el.style.height = `${fragment.size}px`;
          fragment.el.style.opacity = `${alpha}`;
          fragment.el.style.transform = `rotate(${fragment.rot}deg)`;
          fragment.el.style.background = `hsl(${fragment.hue + 20}, 92%, ${52 + alpha * 18}%)`;
          fragment.el.style.boxShadow = `0 0 6px hsla(${fragment.hue}, 90%, 60%, ${alpha})`;
          if (write !== i) frags[write] = fragment;
          write += 1;
        } else {
          fragment.el.remove();
        }
      }
      frags.length = write;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      for (const fragment of fragmentsRef.current) fragment.el.remove();
      fragmentsRef.current = [];
    };
  }, []);

  return (
    <div className="neon-game__health-dock">
      <div className="neon-game__health-meta">
        <span className="neon-game__health-label">Hull integrity</span>
        <span className="neon-game__health-value">
          {Math.ceil(health)} / {maxHealth}
        </span>
      </div>
      <div className="neon-game__health-track" ref={barRef}>
        <div className="neon-game__health-fill" ref={fillRef} />
        <div
          className="neon-game__health-fill neon-game__health-fill--ghost"
          ref={ghostRef}
          style={{ opacity: 0.25 }}
          aria-hidden
        />
        <div ref={fragmentLayerRef} className="neon-game__health-fragments" aria-hidden />
      </div>
    </div>
  );
};
