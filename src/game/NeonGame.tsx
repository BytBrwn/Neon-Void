import React, { useCallback, useEffect, useRef, useState } from "react";
import { DebugPanel } from "./DebugPanel.js";
import { HealthBar } from "./HealthBar.js";
import { DEBUG_TOOLS_ENABLED } from "./debug.js";
import { NeonEngine } from "./engine.js";
import type { GameSnapshot, InputState, ShopItemId, ShipSkinId } from "./types.js";
import { getShipSkinPreviewUrl } from "./shipSkins.js";

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
    waveTotal: 0,
    waveLeft: 0,
    weaponLabel: "STANDARD",
    waveBanner: "",
    credits: 0,
    shopOffers: [],
    shopSkins: [],
    inSandbox: false,
    roundFrozen: false,
    sandboxInvincible: true,
  }));

  const [shopTab, setShopTab] = useState<"upgrades" | "skins">("upgrades");

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

  const buyShopItem = useCallback((id: ShopItemId) => {
    const engine = engineRef.current;
    if (engine?.buyShopItem(id)) {
      syncHud();
    }
  }, [syncHud]);

  const buyOrEquipSkin = useCallback((id: ShipSkinId) => {
    const engine = engineRef.current;
    if (engine?.buyOrEquipSkin(id)) {
      syncHud();
    }
  }, [syncHud]);

  const leaveShop = useCallback(() => {
    engineRef.current?.leaveShop();
    syncHud();
  }, [syncHud]);

  const enterSandbox = useCallback(() => {
    engineRef.current?.enterSandbox();
    syncHud();
  }, [syncHud]);

  const leaveSandbox = useCallback(() => {
    engineRef.current?.exitSandbox();
    syncHud();
  }, [syncHud]);

  const resetSandbox = useCallback(() => {
    engineRef.current?.resetSandbox();
    syncHud();
  }, [syncHud]);

  const exitToMenu = useCallback(() => {
    engineRef.current?.exitToMenu();
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
        if (engine && (engine.phase === "playing" || engine.phase === "paused" || engine.phase === "sandbox")) {
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
    if (!engine || engine.phase === "menu" || engine.phase === "dead" || engine.phase === "shop") {
      return;
    }
    if (engine.phase === "playing" || engine.phase === "sandbox") {
      inputRef.current.mouseDown = true;
    }
  };

  const showRunChrome = hud.phase === "playing" || hud.phase === "paused" || hud.phase === "sandbox";
  const showHealth = showRunChrome;
  const showHudStats = showRunChrome || hud.phase === "shop";

  return (
    <div className="neon-game">
      <canvas
        ref={canvasRef}
        className={`neon-game__canvas${hud.phase === "menu" ? " neon-game__canvas--menu" : ""}`}
        onMouseMove={syncMouse}
        onMouseDown={handleMouseDown}
        onMouseUp={() => {
          inputRef.current.mouseDown = false;
        }}
        onMouseLeave={() => {
          inputRef.current.mouseDown = false;
        }}
      />

      {showHudStats && (
      <div className="neon-game__hud neon-game__chrome">
        {hud.inSandbox && hud.waveBanner && (
          <p className="neon-game__wave-banner neon-game__wave-banner--top" aria-live="polite">
            {hud.waveBanner}
          </p>
        )}
        <div className="neon-game__hud-top">
          <span>SCORE {hud.score.toLocaleString()}</span>
          <span className="neon-game__credits">{hud.credits.toLocaleString()} CR</span>
          <span>WAVE {hud.wave} · {hud.waveLeft}/{hud.waveTotal || "—"}</span>
          {hud.roundFrozen && !hud.inSandbox && <span className="neon-game__sandbox-tag">FROZEN</span>}
          <span>COMBO x{hud.combo}</span>
          <span>HI {hud.highScore.toLocaleString()}</span>
          {showRunChrome && (
            <button className="neon-game__pause-btn" type="button" onClick={togglePause}>
              {hud.phase === "paused" ? "Resume" : "Pause"}
            </button>
          )}
        </div>
        {(showRunChrome || hud.phase === "shop") && (
          <p className="neon-game__weapon">{hud.weaponLabel}</p>
        )}
      </div>
      )}

      {showHealth && (
        <HealthBar health={hud.health} maxHealth={hud.maxHealth} />
      )}

      {hud.phase === "sandbox" && (
        <div className="neon-game__sandbox-hud neon-game__chrome">
          <div className="neon-game__sandbox-bar">
            <span>Sandbox · no waves · spawn enemies from Test panel</span>
            <button className="neon-game__pause-btn" type="button" onClick={leaveSandbox}>
              Exit
            </button>
          </div>
        </div>
      )}

      {hud.phase === "menu" && (
        <div className="neon-game__overlay neon-game__overlay--menu">
          <p className="neon-game__eyebrow">Catalyx Arcade</p>
          <h1 className="neon-game__title">NEON VOID</h1>
          <p className="neon-game__subtitle">
            WASD to drift · Earn credits · Shop every 5 waves · Boss every 10 waves
          </p>
          <button className="neon-game__btn" type="button" onClick={startGame}>
            Launch
          </button>
          {DEBUG_TOOLS_ENABLED && (
            <button className="neon-game__btn neon-game__btn--ghost" type="button" onClick={enterSandbox}>
              Sandbox
            </button>
          )}
        </div>
      )}

      {hud.phase === "shop" && (
        <div className="neon-game__overlay neon-game__overlay--shop">
          <p className="neon-game__eyebrow">Wave {hud.wave} cleared</p>
          <h2 className="neon-game__title neon-game__title--sm">VOID SHOP</h2>
          <p className="neon-game__subtitle neon-game__shop-balance">
            {hud.credits.toLocaleString()} credits available
          </p>
          <div className="neon-game__shop-tabs">
            <button
              type="button"
              className={`neon-game__shop-tab${shopTab === "upgrades" ? " neon-game__shop-tab--active" : ""}`}
              onClick={() => setShopTab("upgrades")}
            >
              Upgrades
            </button>
            <button
              type="button"
              className={`neon-game__shop-tab${shopTab === "skins" ? " neon-game__shop-tab--active" : ""}`}
              onClick={() => setShopTab("skins")}
            >
              Skins
            </button>
          </div>
          {shopTab === "upgrades" && (
            <div className="neon-game__shop-grid">
              {hud.shopOffers.map((offer) => {
                const disabled = offer.soldOut || hud.credits < offer.cost;
                return (
                  <button
                    key={offer.id}
                    className={`neon-game__shop-item${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => buyShopItem(offer.id)}
                  >
                    <span className="neon-game__shop-item-name">{offer.label}</span>
                    <span className="neon-game__shop-item-detail">{offer.detail}</span>
                    <span className="neon-game__shop-item-cost">
                      {offer.soldOut ? "MAXED" : `${offer.cost} CR`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {shopTab === "skins" && (
            <div className="neon-game__shop-grid neon-game__shop-grid--skins">
              {hud.shopSkins.map((skin) => {
                const disabled = skin.equipped || (!skin.owned && hud.credits < skin.cost);
                const costLabel = skin.equipped
                  ? "Equipped"
                  : skin.owned
                    ? "Equip"
                    : skin.cost === 0
                      ? "Free"
                      : `${skin.cost} CR`;
                return (
                  <button
                    key={skin.id}
                    className={`neon-game__shop-item neon-game__shop-item--skin${skin.equipped ? " neon-game__shop-item--equipped" : ""}${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => buyOrEquipSkin(skin.id)}
                  >
                    <img
                      className="neon-game__shop-skin-preview"
                      src={getShipSkinPreviewUrl(skin.id)}
                      alt=""
                      draggable={false}
                    />
                    <span className="neon-game__shop-item-name">{skin.label}</span>
                    <span className="neon-game__shop-item-detail">{skin.detail}</span>
                    <span className="neon-game__shop-item-cost">{costLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button className="neon-game__btn" type="button" onClick={leaveShop}>
            Continue
          </button>
        </div>
      )}

      {hud.phase === "paused" && (
        <div className="neon-game__overlay neon-game__overlay--pause">
          <p className="neon-game__eyebrow">{hud.inSandbox ? "Sandbox paused" : "Paused"}</p>
          <h2 className="neon-game__title neon-game__title--sm">
            {hud.inSandbox ? "SANDBOX HALTED" : "SYSTEM HALTED"}
          </h2>
          <p className="neon-game__subtitle">
            {hud.inSandbox
              ? "Test freely · Esc to resume"
              : `Score ${hud.score.toLocaleString()} · Wave ${hud.wave} · Combo x${hud.combo}`}
          </p>
          <div className="neon-game__overlay-actions">
            <button className="neon-game__btn" type="button" onClick={togglePause}>
              Resume
            </button>
            {hud.inSandbox && (
              <button className="neon-game__btn neon-game__btn--ghost" type="button" onClick={resetSandbox}>
                Reset
              </button>
            )}
            <button className="neon-game__btn neon-game__btn--danger" type="button" onClick={exitToMenu}>
              Exit to Menu
            </button>
          </div>
        </div>
      )}

      {hud.phase === "dead" && (
        <div className="neon-game__overlay neon-game__overlay--dead">
          <p className="neon-game__eyebrow">Ship Destroyed</p>
          <h2 className="neon-game__title neon-game__title--sm">VOID CLAIMED YOU</h2>
          <p className="neon-game__subtitle">
            Score {hud.score.toLocaleString()} · Wave {hud.wave} · {hud.credits.toLocaleString()} CR earned
          </p>
          <button className="neon-game__btn" type="button" onClick={startGame}>
            Respawn
          </button>
        </div>
      )}

      {showRunChrome && (
      <p className="neon-game__controls neon-game__chrome" aria-hidden="true">
        MOVE WASD · FIRE MOUSE / SPACE · PAUSE ESC / P
      </p>
      )}

      <DebugPanel engineRef={engineRef} hud={hud} onChange={syncHud} />
    </div>
  );
};
