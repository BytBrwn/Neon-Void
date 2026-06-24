import React, { useCallback, useEffect, useRef, useState } from "react";
import { DebugPanel } from "./DebugPanel.js";
import { HealthBar } from "./HealthBar.js";
import { DEBUG_TOOLS_ENABLED } from "./debug.js";
import { NeonEngine } from "./engine.js";
import type { BlasterId, GameSnapshot, InputState, ShopSupportId, ShipSkinId } from "./types.js";
import { getShipSkinPreviewUrl, getShipSkinSpec } from "./shipSkins.js";
import { useTouchControls } from "./hooks/useTouchControls.js";
import { ruleBotAction } from "./core/RuleBot.js";
import { agentActionToInput } from "./core/ml.js";
import type { IPersistence } from "./persistence/IPersistence.js";

const AIM_SMOOTHING = 0.65;
const MOBILE_SHAKE_SCALE = 0.5;
const DESKTOP_AIM_LINE_LENGTH = 80;
const JOYSTICK_RING_RADIUS = 52;
const JOYSTICK_DOT_RADIUS = 16;

export type PoolStats = { count: number; capacity: number };

export type DebugStats = {
  fps: number;
  frameMs: number;
  enemies: PoolStats;
  bullets: PoolStats;
  particles: PoolStats;
};

const defaultInput: InputState = {
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
};

function isTouchDevice(): boolean {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

function drawJoystickIndicator(
  ctx: CanvasRenderingContext2D,
  joy: { originX: number; originY: number; stickX: number; stickY: number },
): void {
  ctx.save();
  ctx.fillStyle = "hsla(200, 80%, 60%, 0.18)";
  ctx.strokeStyle = "hsla(200, 90%, 70%, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(joy.originX, joy.originY, JOYSTICK_RING_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "hsla(200, 100%, 80%, 0.55)";
  ctx.beginPath();
  ctx.arc(joy.stickX, joy.stickY, JOYSTICK_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRightThumbCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const size = 8;
  ctx.save();
  ctx.strokeStyle = "hsla(200, 90%, 70%, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function drawDesktopAimLine(
  ctx: CanvasRenderingContext2D,
  muzzleX: number, muzzleY: number,
  aimX: number, aimY: number,
): void {
  const dx = aimX - muzzleX;
  const dy = aimY - muzzleY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const len = Math.min(DESKTOP_AIM_LINE_LENGTH, dist);
  ctx.save();
  ctx.strokeStyle = "hsla(180, 100%, 70%, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(muzzleX, muzzleY);
  ctx.lineTo(muzzleX + (dx / dist) * len, muzzleY + (dy / dist) * len);
  ctx.stroke();
  ctx.restore();
}

function hudChanged(prev: GameSnapshot, next: GameSnapshot): boolean {
  return (
    prev.phase !== next.phase ||
    prev.score !== next.score ||
    prev.wave !== next.wave ||
    prev.combo !== next.combo ||
    prev.health !== next.health ||
    prev.maxHealth !== next.maxHealth ||
    prev.highScore !== next.highScore ||
    prev.waveTotal !== next.waveTotal ||
    prev.waveLeft !== next.waveLeft ||
    prev.blasterLabel !== next.blasterLabel ||
    prev.waveBanner !== next.waveBanner ||
    prev.credits !== next.credits ||
    prev.inSandbox !== next.inSandbox ||
    prev.roundFrozen !== next.roundFrozen ||
    prev.sandboxInvincible !== next.sandboxInvincible ||
    prev.botMode !== next.botMode ||

    prev.shopBlasters !== next.shopBlasters ||
    prev.shopOffers !== next.shopOffers ||
    prev.shopSkins !== next.shopSkins
  );
}

export interface NeonGameProps {
  /** Persistence backend for save/load. Defaults to the engine's built-in localStorage store. */
  store?: IPersistence;
}

export const NeonGame: React.FC<NeonGameProps> = ({ store }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonEngine | null>(null);
  const inputRef = useRef<InputState>({ ...defaultInput, keys: new Set() });
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const hudCacheRef = useRef<GameSnapshot | null>(null);
  const botModeRef = useRef(false);
  const autoRespawnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugStatsRef = useRef<DebugStats>({
    fps: 0,
    frameMs: 0,
    enemies: { count: 0, capacity: 0 },
    bullets: { count: 0, capacity: 0 },
    particles: { count: 0, capacity: 0 },
  });
  const fpsFrameCountRef = useRef(0);
  const fpsSampleStartRef = useRef(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const debugOpenRef = useRef(false);
  const [debugDisplay, setDebugDisplay] = useState<DebugStats>(debugStatsRef.current);

  useEffect(() => { debugOpenRef.current = debugOpen; }, [debugOpen]);

  const {
    inputModeRef,
    joystickVisualRef,
    rightThumbVisualRef,
    touchAimRef,
    fireGraceUntilRef,
    rightTouchIdRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useTouchControls(inputRef, canvasRef);

  const [hud, setHud] = useState<GameSnapshot>(() => ({
    phase: "menu", score: 0, wave: 1, combo: 0, health: 100, maxHealth: 100,
    highScore: 0, waveTotal: 0, waveLeft: 0, blasterLabel: "PULSE BOLT",
    waveBanner: "", credits: 0, shopBlasters: [], shopOffers: [], shopSkins: [],
    inSandbox: false, roundFrozen: false, sandboxInvincible: true, botMode: false,
  }));

  const [shopTab, setShopTab] = useState<"blasters" | "support" | "skins">("blasters");

  const applyHud = useCallback((snap: GameSnapshot) => {
    const prev = hudCacheRef.current;
    if (prev && !hudChanged(prev, snap)) return;
    hudCacheRef.current = snap;
    setHud(snap);
  }, []);

  const syncHud = useCallback(() => {
    if (engineRef.current) applyHud({ ...engineRef.current.snapshot(), botMode: botModeRef.current });
  }, [applyHud]);

  const togglePause = useCallback(() => { engineRef.current?.togglePause(); syncHud(); }, [syncHud]);
  const startGame = useCallback(() => { botModeRef.current = false; engineRef.current?.start(); syncHud(); }, [syncHud]);
  const buyShopSupport = useCallback((id: ShopSupportId) => { if (engineRef.current?.buyShopSupport(id)) syncHud(); }, [syncHud]);
  const buyOrEquipBlaster = useCallback((id: BlasterId) => { if (engineRef.current?.buyOrEquipBlaster(id)) syncHud(); }, [syncHud]);
  const buyOrEquipSkin = useCallback((id: ShipSkinId) => { if (engineRef.current?.buyOrEquipSkin(id)) syncHud(); }, [syncHud]);
  const leaveShop = useCallback(() => { engineRef.current?.leaveShop(); syncHud(); }, [syncHud]);
  const enterSandbox = useCallback(() => { engineRef.current?.enterSandbox(); syncHud(); }, [syncHud]);
  const leaveSandbox = useCallback(() => { engineRef.current?.exitSandbox(); syncHud(); }, [syncHud]);
  const resetSandbox = useCallback(() => { engineRef.current?.resetSandbox(); syncHud(); }, [syncHud]);
  const exitToMenu = useCallback(() => { botModeRef.current = false; engineRef.current?.exitToMenu(); syncHud(); }, [syncHud]);

  // Main game loop setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;

    const engine = new NeonEngine({ store });
    engineRef.current = engine;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const overlayCtx = overlay ? overlay.getContext("2d") : null;

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
      applyHud({ ...engine.snapshot(), botMode: botModeRef.current });
    };

    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number): void => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(0.033, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // FPS sampling — average over a rolling ~500ms window
      fpsFrameCountRef.current += 1;
      if (!fpsSampleStartRef.current) fpsSampleStartRef.current = now;
      const fpsElapsed = now - fpsSampleStartRef.current;
      if (fpsElapsed >= 500) {
        debugStatsRef.current.fps = (fpsFrameCountRef.current * 1000) / fpsElapsed;
        debugStatsRef.current.frameMs = fpsElapsed / fpsFrameCountRef.current;
        fpsFrameCountRef.current = 0;
        fpsSampleStartRef.current = now;
      }

      const touchMode = inputModeRef.current === "touch";
      const playing = engine.phase === "playing" || engine.phase === "sandbox";
      canvas.classList.toggle("neon-game__canvas--crosshair", !touchMode && playing);

      // Smooth aim for touch mode
      if (touchMode) {
        const aim = touchAimRef.current;
        aim.x += (aim.targetX - aim.x) * AIM_SMOOTHING;
        aim.y += (aim.targetY - aim.y) * AIM_SMOOTHING;
        inputRef.current.mouseX = aim.x;
        inputRef.current.mouseY = aim.y;
        if (playing) {
          inputRef.current.mouseDown =
            rightTouchIdRef.current !== null || now < fireGraceUntilRef.current;
        }
      }

      // Bot mode: override shop and playing input
      if (botModeRef.current) {
        if (engine.phase === "shop") {
          engine.buyShopSupport("repair");
          engine.leaveShop();
          syncHud();
        } else if (engine.phase === "playing" || engine.phase === "sandbox") {
          inputRef.current = agentActionToInput(ruleBotAction(engine), engine);
        } else if (engine.phase === "dead") {
          if (!autoRespawnRef.current) {
            autoRespawnRef.current = setTimeout(() => {
              autoRespawnRef.current = null;
              engine.start();
              syncHud();
            }, 1500);
          }
        }
      }

      engine.update(dt, inputRef.current);

      // Dampen shake on mobile
      if (touchMode && engine.shake > 0) engine.shake *= MOBILE_SHAKE_SCALE;

      engine.draw(ctx);

      // Draw touch/desktop overlays
      if (overlayCtx && overlay) {
        overlayCtx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
        if (touchMode) {
          const joy = joystickVisualRef.current;
          if (joy.active) drawJoystickIndicator(overlayCtx, joy);
          const thumb = rightThumbVisualRef.current;
          if (thumb.active) drawRightThumbCrosshair(overlayCtx, thumb.x, thumb.y);
        } else if (playing) {
          const p = engine.player;
          const spec = getShipSkinSpec(p.skin);
          const muzzleX = p.x + Math.cos(p.aimAngle) * spec.muzzleOffset;
          const muzzleY = p.y + Math.sin(p.aimAngle) * spec.muzzleOffset;
          drawDesktopAimLine(overlayCtx, muzzleX, muzzleY, inputRef.current.mouseX, inputRef.current.mouseY);
        }
      }

      // Poll HUD at 4 Hz (250ms) to avoid setState on every frame
      if (Math.floor(now / 250) % 2 === 0) {
        applyHud({ ...engine.snapshot(), botMode: botModeRef.current });
        if (debugOpenRef.current) {
          debugStatsRef.current.enemies = { count: engine.enemies.count, capacity: engine.enemies.capacity };
          debugStatsRef.current.bullets = { count: engine.bullets.count, capacity: engine.bullets.capacity };
          debugStatsRef.current.particles = { count: engine.particles.count, capacity: engine.particles.capacity };
          setDebugDisplay({ ...debugStatsRef.current });
        }
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
      if (autoRespawnRef.current) { clearTimeout(autoRespawnRef.current); autoRespawnRef.current = null; }
      engine.destroy();
      engineRef.current = null;
    };
  }, [applyHud, inputModeRef, touchAimRef, rightTouchIdRef, fireGraceUntilRef, joystickVisualRef, rightThumbVisualRef, store]);

  // Keyboard input
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
    const onKeyUp = (e: KeyboardEvent): void => { inputRef.current.keys.delete(e.code); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [applyHud]);

  const syncMouse = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    inputModeRef.current = "mouse";
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    inputRef.current.mouseX = event.clientX - rect.left;
    inputRef.current.mouseY = event.clientY - rect.top;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    inputModeRef.current = "mouse";
    syncMouse(event);
    const engine = engineRef.current;
    if (!engine || engine.phase === "menu" || engine.phase === "dead" || engine.phase === "shop") return;
    if (engine.phase === "playing" || engine.phase === "sandbox") {
      inputRef.current.mouseDown = true;
    }
  };

  const showRunChrome = hud.phase === "playing" || hud.phase === "paused" || hud.phase === "sandbox";
  const showHealth = showRunChrome;
  const showHudStats = showRunChrome || hud.phase === "shop";
  const touchCapable = isTouchDevice();

  return (
    <div className="neon-game">
      <div className="neon-game__stage">
        <canvas
          ref={canvasRef}
          className={`neon-game__canvas${hud.phase === "menu" ? " neon-game__canvas--menu" : ""}`}
          onMouseMove={syncMouse}
          onMouseDown={handleMouseDown}
          onMouseUp={() => { if (inputModeRef.current === "mouse") inputRef.current.mouseDown = false; }}
          onMouseLeave={() => { if (inputModeRef.current === "mouse") inputRef.current.mouseDown = false; }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />
        <canvas ref={overlayRef} className="neon-game__touch-overlay" aria-hidden />
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
            {hud.botMode && <span className="neon-game__sandbox-tag">BOT</span>}
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

      {showHealth && <HealthBar health={hud.health} maxHealth={hud.maxHealth} />}

      {hud.phase === "sandbox" && (
        <div className="neon-game__sandbox-hud neon-game__chrome">
          <div className="neon-game__sandbox-bar">
            <span>Sandbox · no waves · spawn enemies from Test panel</span>
            <button className="neon-game__pause-btn" type="button" onClick={leaveSandbox}>Exit</button>
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
          <button className="neon-game__btn" type="button" onClick={startGame}>Launch</button>
          {DEBUG_TOOLS_ENABLED && (
            <button className="neon-game__btn neon-game__btn--ghost" type="button" onClick={enterSandbox}>
              Sandbox
            </button>
          )}
          <button className="neon-game__btn neon-game__btn--ai" type="button" onClick={() => {
            startGame();
            botModeRef.current = true;
            syncHud();
          }}>AI Mode</button>
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
            {(["blasters", "support", "skins"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`neon-game__shop-tab${shopTab === tab ? " neon-game__shop-tab--active" : ""}`}
                onClick={() => setShopTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {shopTab === "blasters" && (
            <div className="neon-game__shop-grid">
              {hud.shopBlasters.map((blaster) => {
                const disabled = blaster.equipped || (!blaster.owned && hud.credits < blaster.cost);
                const costLabel = blaster.equipped ? "Equipped" : blaster.owned ? "Equip" : blaster.cost === 0 ? "Starter" : `${blaster.cost} CR`;
                return (
                  <button
                    key={blaster.id}
                    className={`neon-game__shop-item${blaster.equipped ? " neon-game__shop-item--equipped" : ""}${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button" disabled={disabled}
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
                    type="button" disabled={disabled}
                    onClick={() => buyShopSupport(offer.id)}
                  >
                    <span className="neon-game__shop-item-name">{offer.label}</span>
                    <span className="neon-game__shop-item-detail">{offer.detail}</span>
                    <span className="neon-game__shop-item-cost">{offer.soldOut ? "MAXED" : `${offer.cost} CR`}</span>
                  </button>
                );
              })}
            </div>
          )}

          {shopTab === "skins" && (
            <div className="neon-game__shop-grid neon-game__shop-grid--skins">
              {hud.shopSkins.map((skin) => {
                const disabled = skin.equipped || (!skin.owned && hud.credits < skin.cost);
                const costLabel = skin.equipped ? "Equipped" : skin.owned ? "Equip" : skin.cost === 0 ? "Free" : `${skin.cost} CR`;
                return (
                  <button
                    key={skin.id}
                    className={`neon-game__shop-item neon-game__shop-item--skin${skin.equipped ? " neon-game__shop-item--equipped" : ""}${disabled ? " neon-game__shop-item--disabled" : ""}`}
                    type="button" disabled={disabled}
                    onClick={() => buyOrEquipSkin(skin.id)}
                  >
                    <img className="neon-game__shop-skin-preview" src={getShipSkinPreviewUrl(skin.id)} alt="" draggable={false} />
                    <span className="neon-game__shop-item-name">{skin.label}</span>
                    <span className="neon-game__shop-item-detail">{skin.detail}</span>
                    <span className="neon-game__shop-item-cost">{costLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button className="neon-game__btn" type="button" onClick={leaveShop}>Continue</button>
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
            <button className="neon-game__btn" type="button" onClick={togglePause}>Resume</button>
            {hud.inSandbox && (
              <button className="neon-game__btn neon-game__btn--ghost" type="button" onClick={resetSandbox}>Reset</button>
            )}
            <button className="neon-game__btn neon-game__btn--danger" type="button" onClick={exitToMenu}>Exit to Menu</button>
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
          <button className="neon-game__btn" type="button" onClick={startGame}>Respawn</button>
        </div>
      )}

      {showRunChrome && (
        <p className="neon-game__controls neon-game__chrome" aria-hidden="true">
          {touchCapable
            ? "LEFT THUMB MOVE · RIGHT THUMB AIM & FIRE · PAUSE ESC / P"
            : "MOVE WASD · FIRE MOUSE / SPACE · PAUSE ESC / P"}
        </p>
      )}

      {debugOpen && (
        <p className="neon-game__fps-meter" aria-hidden="true">
          {Math.round(debugDisplay.fps)} FPS · {debugDisplay.frameMs.toFixed(1)}ms
        </p>
      )}

      <DebugPanel
        engineRef={engineRef}
        hud={hud}
        onChange={syncHud}
        open={debugOpen}
        onToggleOpen={() => setDebugOpen((value) => !value)}
        stats={debugDisplay}
      />
    </div>
  );
};
