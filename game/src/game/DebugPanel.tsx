import React from "react";
import type { NeonEngine } from "./engine.js";
import { DEBUG_TOOLS_ENABLED } from "./debug.js";
import type { GameSnapshot } from "./types.js";
import type { DebugStats } from "./NeonGame.js";

type DebugPanelProps = {
  engineRef: React.RefObject<NeonEngine | null>;
  hud: GameSnapshot;
  onChange: () => void;
  open: boolean;
  onToggleOpen: () => void;
  stats: DebugStats;
  onStopBotMode: () => void;
};

function poolLine(label: string, pool: { count: number; capacity: number }): string {
  return `${label} ${pool.count}/${pool.capacity}`;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ engineRef, hud, onChange, open, onToggleOpen, stats, onStopBotMode }) => {
  if (!DEBUG_TOOLS_ENABLED) return null;

  const run = (action: (engine: NeonEngine) => void): void => {
    const engine = engineRef.current;
    if (!engine) return;
    action(engine);
    onChange();
  };

  return (
    <div className={`neon-debug${open ? " neon-debug--open" : ""}`}>
      <button
        className="neon-debug__toggle"
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
      >
        {open ? "Hide debug" : "Debug"}
      </button>

      {open && (
        <div className="neon-debug__panel">
          <p className="neon-debug__label">QA / Engine stats</p>
          <div className="neon-debug__stats">
            <span>{Math.round(stats.fps)} FPS · {stats.frameMs.toFixed(1)}ms/frame</span>
            <span>{poolLine("Enemies", stats.enemies)}</span>
            <span>{poolLine("Bullets", stats.bullets)}</span>
            <span>{poolLine("Particles", stats.particles)}</span>
            <span>Phase: {hud.phase}{hud.botMode ? " · BOT" : ""}</span>
          </div>

          <p className="neon-debug__label">Debug actions</p>
          <div className="neon-debug__actions">
            {hud.botMode && (
              <button type="button" className="neon-debug__btn--active" onClick={onStopBotMode}>
                Stop AI
              </button>
            )}
            {hud.inSandbox ? (
              <button type="button" className="neon-debug__btn--active" onClick={() => run((e) => e.exitSandbox())}>
                Exit sandbox
              </button>
            ) : (
              <button type="button" onClick={() => run((e) => e.enterSandbox())}>
                Sandbox
              </button>
            )}
            <button
              type="button"
              className={hud.roundFrozen ? "neon-debug__btn--active" : undefined}
              onClick={() => run((e) => e.toggleRoundFreeze())}
              disabled={hud.inSandbox}
            >
              {hud.roundFrozen ? "Unfreeze" : "Freeze round"}
            </button>
            <button
              type="button"
              className={hud.sandboxInvincible ? "neon-debug__btn--active" : undefined}
              onClick={() => run((e) => e.toggleSandboxInvincible())}
              disabled={!hud.inSandbox}
            >
              Invincible
            </button>
            <button type="button" onClick={() => run((e) => e.debugSpawnEnemy("skitter"))}>
              + Skitter
            </button>
            <button type="button" onClick={() => run((e) => e.debugSpawnEnemy("hunter"))}>
              + Hunter
            </button>
            <button type="button" onClick={() => run((e) => e.debugSpawnEnemy("boss"))}>
              + Boss
            </button>
            <button type="button" onClick={() => run((e) => e.debugCompleteWave())}>
              Clear wave
            </button>
            <button type="button" onClick={() => run((e) => e.debugAdvanceWave())}>
              Skip wave
            </button>
            <button type="button" onClick={() => run((e) => e.debugOpenShop())}>
              Open shop
            </button>
            <button type="button" onClick={() => run((e) => e.debugGoToWave(5))}>
              Wave 5
            </button>
            <button type="button" onClick={() => run((e) => e.debugGoToWave(10))}>
              Wave 10
            </button>
            <button type="button" onClick={() => run((e) => e.debugAddCredits(100))}>
              +100 CR
            </button>
            <button type="button" onClick={() => run((e) => e.debugFullHeal())}>
              Full heal
            </button>
            <button type="button" onClick={() => run((e) => e.debugKillAllEnemies())}>
              Kill all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
