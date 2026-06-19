import React, { useState } from "react";
import type { NeonEngine } from "./engine.js";
import { DEBUG_TOOLS_ENABLED } from "./debug.js";
import type { GameSnapshot } from "./types.js";

type DebugPanelProps = {
  engineRef: React.RefObject<NeonEngine | null>;
  hud: GameSnapshot;
  onChange: () => void;
};

export const DebugPanel: React.FC<DebugPanelProps> = ({ engineRef, hud, onChange }) => {
  const [open, setOpen] = useState(false);

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
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "Hide test" : "Test"}
      </button>

      {open && (
        <div className="neon-debug__panel">
          <p className="neon-debug__label">Debug only</p>
          <div className="neon-debug__actions">
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
