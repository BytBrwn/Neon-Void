import React, { useCallback, useEffect, useRef, useState } from "react";
import { NeonEngine } from "./engine.js";
import type { GameSnapshot, InputState } from "./types.js";

const defaultInput: InputState = {
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
};

export const NeonGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonEngine | null>(null);
  const inputRef = useRef<InputState>({ ...defaultInput, keys: new Set() });
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [hud, setHud] = useState<GameSnapshot>(() => ({
    phase: "menu",
    score: 0,
    wave: 1,
    combo: 0,
    health: 100,
    maxHealth: 100,
    highScore: 0,
  }));

  const syncHud = useCallback(() => {
    if (engineRef.current) {
      setHud(engineRef.current.snapshot());
    }
  }, []);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
    syncHud();
  }, [syncHud]);

  const startGame = useCallback(() => {
    engineRef.current?.start();
    syncHud();
  }, [syncHud]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new NeonEngine();
    engineRef.current = engine;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.resize(width, height);
      setHud(engine.snapshot());
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number): void => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(0.033, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      engine.update(dt, inputRef.current);
      engine.draw(ctx);

      if (Math.floor(now / 120) % 2 === 0) {
        setHud(engine.snapshot());
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        if (event.repeat) return;
        const engine = engineRef.current;
        if (engine && (engine.phase === "playing" || engine.phase === "paused")) {
          engine.togglePause();
          setHud(engine.snapshot());
        }
        return;
      }

      inputRef.current.keys.add(event.code);

      if (event.code === "Enter") {
        const engine = engineRef.current;
        if (engine && (engine.phase === "menu" || engine.phase === "dead")) {
          engine.start();
          setHud(engine.snapshot());
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      inputRef.current.keys.delete(event.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const syncMouse = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    inputRef.current.mouseX = event.clientX - rect.left;
    inputRef.current.mouseY = event.clientY - rect.top;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    syncMouse(event);
    const engine = engineRef.current;
    if (engine?.phase === "menu") {
      startGame();
      return;
    }
    if (engine?.phase === "playing") {
      inputRef.current.mouseDown = true;
    }
  };

  return (
    <div className="neon-game">
      <canvas
        ref={canvasRef}
        className="neon-game__canvas"
        onMouseMove={syncMouse}
        onMouseDown={handleMouseDown}
        onMouseUp={() => {
          inputRef.current.mouseDown = false;
        }}
        onMouseLeave={() => {
          inputRef.current.mouseDown = false;
        }}
      />

      <div className="neon-game__hud">
        <div className="neon-game__hud-top">
          <span>SCORE {hud.score.toLocaleString()}</span>
          <span>WAVE {hud.wave}</span>
          <span>COMBO x{hud.combo}</span>
          <span>HI {hud.highScore.toLocaleString()}</span>
          {(hud.phase === "playing" || hud.phase === "paused") && (
            <button className="neon-game__pause-btn" type="button" onClick={togglePause}>
              {hud.phase === "paused" ? "Resume" : "Pause"}
            </button>
          )}
        </div>
        <div className="neon-game__health">
          <div
            className="neon-game__health-fill"
            style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
          />
        </div>
      </div>

      {hud.phase === "menu" && (
        <div className="neon-game__overlay">
          <p className="neon-game__eyebrow">Catalyx Arcade</p>
          <h1 className="neon-game__title">NEON VOID</h1>
          <p className="neon-game__subtitle">
            WASD to drift · Mouse to aim · Hold fire to shred · Esc to pause
          </p>
          <button className="neon-game__btn" type="button" onClick={startGame}>
            Launch
          </button>
        </div>
      )}

      {hud.phase === "paused" && (
        <div className="neon-game__overlay neon-game__overlay--pause">
          <p className="neon-game__eyebrow">Paused</p>
          <h2 className="neon-game__title neon-game__title--sm">SYSTEM HALTED</h2>
          <p className="neon-game__subtitle">
            Score {hud.score.toLocaleString()} · Wave {hud.wave} · Combo x{hud.combo}
          </p>
          <button className="neon-game__btn" type="button" onClick={togglePause}>
            Resume
          </button>
        </div>
      )}

      {hud.phase === "dead" && (
        <div className="neon-game__overlay neon-game__overlay--dead">
          <p className="neon-game__eyebrow">Ship Destroyed</p>
          <h2 className="neon-game__title neon-game__title--sm">VOID CLAIMED YOU</h2>
          <p className="neon-game__subtitle">
            Score {hud.score.toLocaleString()} · Wave {hud.wave}
          </p>
          <button className="neon-game__btn" type="button" onClick={startGame}>
            Respawn
          </button>
        </div>
      )}

      <p className="neon-game__controls" aria-hidden="true">
        MOVE WASD · FIRE MOUSE / SPACE · PAUSE ESC / P
      </p>
    </div>
  );
};
