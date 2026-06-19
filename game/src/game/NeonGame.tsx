import React, { useCallback, useEffect, useRef, useState } from "react";
import { DebugPanel } from "./DebugPanel.js";
import { HealthBar } from "./HealthBar.js";
import { DEBUG_TOOLS_ENABLED } from "./debug.js";
import { NeonEngine } from "./engine.js";
import type { BlasterId, GameSnapshot, InputState, ShopSupportId, ShipSkinId } from "./types.js";
import { getShipSkinPreviewUrl } from "./shipSkins.js";

const defaultInput: InputState = {
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
};

const JOYSTICK_DEAD_ZONE = 12;
const JOYSTICK_MAX_RADIUS = 56;
const JOYSTICK_RING_RADIUS = 44;

type CanvasPoint = { x: number; y: number; width: number; height: number };

type LeftTouchState = {
  id: number;
  originX: number;
  originY: number;
};

type JoystickVisual = {
  originX: number;
  originY: number;
  stickX: number;
  stickY: number;
  active: boolean;
};

function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function clearTouchArrowKeys(keys: Set<string>, touchArrowKeys: Set<string>): void {
  for (const code of touchArrowKeys) keys.delete(code);
  touchArrowKeys.clear();
}

function applyJoystickToKeys(
  keys: Set<string>,
  touchArrowKeys: Set<string>,
  dx: number,
  dy: number,
): void {
  clearTouchArrowKeys(keys, touchArrowKeys);
  const dist = Math.hypot(dx, dy);
  if (dist < JOYSTICK_DEAD_ZONE) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const threshold = 0.38;

  if (nx < -threshold) {
    keys.add("ArrowLeft");
    touchArrowKeys.add("ArrowLeft");
  } else if (nx > threshold) {
    keys.add("ArrowRight");
    touchArrowKeys.add("ArrowRight");
  }
  if (ny < -threshold) {
    keys.add("ArrowUp");
    touchArrowKeys.add("ArrowUp");
  } else if (ny > threshold) {
    keys.add("ArrowDown");
    touchArrowKeys.add("ArrowDown");
  }
}

function clampJoystickDelta(dx: number, dy: number): { dx: number; dy: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= JOYSTICK_MAX_RADIUS || dist === 0) return { dx, dy };
  const scale = JOYSTICK_MAX_RADIUS / dist;
  return { dx: dx * scale, dy: dy * scale };
}

function drawJoystickIndicator(ctx: CanvasRenderingContext2D, joy: JoystickVisual): void {
  ctx.save();
  ctx.strokeStyle = "rgba(180, 255, 230, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joy.originX, joy.originY, JOYSTICK_RING_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 255, 220, 0.38)";
  ctx.strokeStyle = "rgba(180, 255, 240, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(joy.stickX, joy.stickY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function hudChanged(prev: GameSnapshot, next: GameSnapshot): boolean {
  return (
    prev.phase !== next.phase
    || prev.score !== next.score
    || prev.wave !== next.wave
    || prev.combo !== next.combo
    || prev.health !== next.health
    || prev.maxHealth !== next.maxHealth
    || prev.highScore !== next.highScore
    || prev.waveTotal !== next.waveTotal
    || prev.waveLeft !== next.waveLeft
    || prev.blasterLabel !== next.blasterLabel
    || prev.waveBanner !== next.waveBanner
    || prev.credits !== next.credits
    || prev.inSandbox !== next.inSandbox
    || prev.roundFrozen !== next.roundFrozen
    || prev.sandboxInvincible !== next.sandboxInvincible
    || prev.shopBlasters !== next.shopBlasters
    || prev.shopOffers !== next.shopOffers
    || prev.shopSkins !== next.shopSkins
  );
}

export const NeonGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonEngine | null>(null);
  const inputRef = useRef<InputState>({ ...defaultInput, keys: new Set() });
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const touchEnabled = typeof window !== "undefined" && "ontouchstart" in window;
  const leftTouchRef = useRef<LeftTouchState | null>(null);
  const rightTouchIdRef = useRef<number | null>(null);
  const touchArrowKeysRef = useRef<Set<string>>(new Set());
  const joystickVisualRef = useRef<JoystickVisual>({
    originX: 0,
    originY: 0,
    stickX: 0,
    stickY: 0,
    active: false,
  });

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
    blasterLabel: "PULSE BOLT",
    waveBanner: "",
    credits: 0,
    shopBlasters: [],
    shopOffers: [],
    shopSkins: [],
    inSandbox: false,
    roundFrozen: false,
    sandboxInvincible: true,
  }));

  const [shopTab, setShopTab] = useState<"blasters" | "support" | "skins">("blasters");
  const hudCacheRef = useRef<GameSnapshot | null>(null);

  const applyHud = useCallback((snap: GameSnapshot) => {
    const prev = hudCacheRef.current;
    if (prev && !hudChanged(prev, snap)) return;
    hudCacheRef.current = snap;
    setHud(snap);
  }, []);

  const syncHud = useCallback(() => {
    if (engineRef.current) {
      applyHud(engineRef.current.snapshot());
    }
  }, [applyHud]);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
    syncHud();
  }, [syncHud]);

  const startGame = useCallback(() => {
    engineRef.current?.start();
    syncHud();
  }, [syncHud]);

  const buyShopSupport = useCallback((id: ShopSupportId) => {
    const engine = engineRef.current;
    if (engine?.buyShopSupport(id)) {
      syncHud();
    }
  }, [syncHud]);

  const buyOrEquipBlaster = useCallback((id: BlasterId) => {
    const engine = engineRef.current;
    if (engine?.buyOrEquipBlaster(id)) {
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
    const overlay = overlayRef.current;
    if (!canvas) return;

    const engine = new NeonEngine();
    engineRef.current = engine;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const overlayCtx = touchEnabled && overlay ? overlay.getContext("2d") : null;

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
      if (overlay && overlayCtx) {
        overlay.width = Math.floor(width * dpr);
        overlay.height = Math.floor(height * dpr);
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      engine.resize(width, height);
      applyHud(engine.snapshot());
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number): void => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(0.033, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      engine.update(dt, inputRef.current);
      engine.draw(ctx);

      if (overlayCtx && overlay) {
        overlayCtx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
        const joy = joystickVisualRef.current;
        if (joy.active) drawJoystickIndicator(overlayCtx, joy);
      }

      if (Math.floor(now / 250) % 2 === 0) {
        applyHud(engine.snapshot());
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
      engine.destroy();
      engineRef.current = null;
    };
  }, [applyHud, touchEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        if (event.repeat) return;
        const engine = engineRef.current;
        if (engine && (engine.phase === "playing" || engine.phase === "paused" || engine.phase === "sandbox")) {
          engine.togglePause();
          applyHud(engine.snapshot());
        }
        return;
      }

      inputRef.current.keys.add(event.code);

      if (event.code === "Enter") {
        const engine = engineRef.current;
        if (engine && (engine.phase === "menu" || engine.phase === "dead")) {
          engine.start();
          applyHud(engine.snapshot());
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
  }, [applyHud]);

  const syncMouse = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = canvasPoint(canvas, event.clientX, event.clientY);
    inputRef.current.mouseX = point.x;
    inputRef.current.mouseY = point.y;
  };

  const touchGameplayActive = (): boolean => {
    const engine = engineRef.current;
    return !!engine && (engine.phase === "playing" || engine.phase === "sandbox");
  };

  const releaseLeftTouch = (): void => {
    leftTouchRef.current = null;
    clearTouchArrowKeys(inputRef.current.keys, touchArrowKeysRef.current);
    joystickVisualRef.current.active = false;
  };

  const releaseRightTouch = (): void => {
    rightTouchIdRef.current = null;
    inputRef.current.mouseDown = false;
  };

  const updateLeftTouch = (point: CanvasPoint): void => {
    const left = leftTouchRef.current;
    if (!left) return;

    const rawDx = point.x - left.originX;
    const rawDy = point.y - left.originY;
    const { dx, dy } = clampJoystickDelta(rawDx, rawDy);

    joystickVisualRef.current = {
      originX: left.originX,
      originY: left.originY,
      stickX: left.originX + dx,
      stickY: left.originY + dy,
      active: true,
    };
    applyJoystickToKeys(inputRef.current.keys, touchArrowKeysRef.current, dx, dy);
  };

  const updateRightTouch = (point: CanvasPoint): void => {
    inputRef.current.mouseX = point.x;
    inputRef.current.mouseY = point.y;
    if (touchGameplayActive()) {
      inputRef.current.mouseDown = true;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (!touchEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const touch of Array.from(event.changedTouches)) {
      const point = canvasPoint(canvas, touch.clientX, touch.clientY);
      const onLeft = point.x < point.width * 0.5;

      if (onLeft && !leftTouchRef.current) {
        leftTouchRef.current = {
          id: touch.identifier,
          originX: point.x,
          originY: point.y,
        };
        updateLeftTouch(point);
      } else if (!onLeft && rightTouchIdRef.current === null) {
        rightTouchIdRef.current = touch.identifier;
        updateRightTouch(point);
      }
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (!touchEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const touch of Array.from(event.changedTouches)) {
      const point = canvasPoint(canvas, touch.clientX, touch.clientY);
      const left = leftTouchRef.current;
      if (left && touch.identifier === left.id) {
        updateLeftTouch(point);
        continue;
      }
      if (touch.identifier === rightTouchIdRef.current) {
        updateRightTouch(point);
      }
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (!touchEnabled) return;

    for (const touch of Array.from(event.changedTouches)) {
      if (leftTouchRef.current?.id === touch.identifier) {
        releaseLeftTouch();
      }
      if (rightTouchIdRef.current === touch.identifier) {
        releaseRightTouch();
      }
    }
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
      <div className="neon-game__stage">
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />
        {touchEnabled && (
          <canvas
            ref={overlayRef}
            className="neon-game__touch-overlay"
            aria-hidden
          />
        )}
      </div>

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
          <p className="neon-game__weapon">{hud.blasterLabel}</p>
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
            WASD to drift · Start with Pulse Bolt · Unlock blasters in the shop
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
              className={`neon-game__shop-tab${shopTab === "blasters" ? " neon-game__shop-tab--active" : ""}`}
              onClick={() => setShopTab("blasters")}
            >
              Blasters
            </button>
            <button
              type="button"
              className={`neon-game__shop-tab${shopTab === "support" ? " neon-game__shop-tab--active" : ""}`}
              onClick={() => setShopTab("support")}
            >
              Support
            </button>
            <button
              type="button"
              className={`neon-game__shop-tab${shopTab === "skins" ? " neon-game__shop-tab--active" : ""}`}
              onClick={() => setShopTab("skins")}
            >
              Skins
            </button>
          </div>
          {shopTab === "blasters" && (
            <div className="neon-game__shop-grid">
              {hud.shopBlasters.map((blaster) => {
                const disabled = blaster.equipped || (!blaster.owned && hud.credits < blaster.cost);
                const costLabel = blaster.equipped
                  ? "Equipped"
                  : blaster.owned
                    ? "Equip"
                    : blaster.cost === 0
                      ? "Starter"
                      : `${blaster.cost} CR`;
                return (
                  <button
                    key={blaster.id}
                    className={`neon-game__shop-item${blaster.equipped ? " neon-game__shop-item--equipped" : ""}${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => buyOrEquipBlaster(blaster.id)}
                  >
                    <span className="neon-game__shop-item-name">{blaster.label}</span>
                    <span className="neon-game__shop-item-detail">{blaster.detail}</span>
                    <span className="neon-game__shop-item-cost">{costLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          {shopTab === "support" && (
            <div className="neon-game__shop-grid">
              {hud.shopOffers.map((offer) => {
                const disabled = offer.soldOut || hud.credits < offer.cost;
                return (
                  <button
                    key={offer.id}
                    className={`neon-game__shop-item${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => buyShopSupport(offer.id)}
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
        {touchEnabled
          ? "LEFT THUMB MOVE · RIGHT THUMB AIM & FIRE · PAUSE ESC / P"
          : "MOVE WASD · FIRE MOUSE / SPACE · PAUSE ESC / P"}
      </p>
      )}

      <DebugPanel engineRef={engineRef} hud={hud} onChange={syncHud} />
    </div>
  );
};
