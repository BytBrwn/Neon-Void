/**
 * GameSim — pure game simulation. Zero canvas / DOM dependency.
 *
 * Can run headlessly (headless: true) for ML training: skips all particle
 * effects, enabling thousands of steps per second without GC pressure.
 *
 * Rendering is handled by GameRenderer which reads public state from here.
 */

import type {
  BlasterId,
  Enemy,
  EnemyKind,
  GamePhase,
  GameSnapshot,
  InputState,
  Player,
  Powerup,
  ShopBlasterOffer,
  ShopOffer,
  ShopSkinOffer,
  ShopSupportId,
  ShipSkinId,
  Vec2,
} from "../types.js";
import type { IPersistence } from "../persistence/IPersistence.js";
import { defaultPersistence } from "../persistence/LocalStoragePersistence.js";
import { Pool } from "./Pool.js";
import { loadPowerupIcons } from "../assets/powerupIcons.js";
import { blasterLabel as formatBlasterLabel, computeBlasterVolley, getBlasterDef, BLASTERS } from "../factories/blasterFactory.js";
import { createEnemy as buildEnemy, ENEMY_CREDITS, ENEMY_SCORE } from "../factories/enemyFactory.js";
import { createGameLogger, type GameLogger } from "../console/logger.js";
import { getShipSkinSpec, loadShipSkins, SHIP_SKINS, type ShipSkinSpec } from "../assets/shipSkins.js";
import {
  clamp,
  dist,
  expSmoothing,
  lerpAngle,
  normalize,
  rand,
  random,
  randomEdgePoint as mathRandomEdgePoint,
  waveScale as computeWaveScale,
} from "../math.js";
import {
  loadEquippedBlaster,
  loadEquippedSkin,
  loadHighScore,
  loadOwnedBlasters,
  loadOwnedSkins,
  saveBlasterProgress,
  saveHighScore,
  saveSkinProgress,
} from "../persistence.js";
import { AmbientField, type AmbientMotion } from "../systems/ambient.js";
import {
  createBulletPool,
  shoot as spawnBullet,
  tickBullets,
  type BulletPool,
} from "../systems/bullets.js";
import {
  burst as particleBurst,
  createParticlePool,
  pushParticle,
  shockwave as particleShockwave,
  tickParticles,
  type ParticlePool,
} from "../systems/particles.js";
import {
  applyPowerup,
  createPowerupDrop,
  powerupHue,
  tickPowerups,
} from "../systems/powerups.js";
import {
  applyShopSupport as applyShopSupportEffect,
  buildShopBlasters,
  buildShopOffers,
  buildShopSkins,
} from "../systems/shop.js";
import {
  isBossWave as wavesIsBossWave,
  isShopWave as wavesIsShopWave,
  pickSpawnKind as wavesPickSpawnKind,
  randomWaveCount as wavesRandomWaveCount,
  waveClearBonus,
} from "../systems/waves.js";

const CONTACT_DAMAGE: Partial<Record<EnemyKind, number>> = {
  boss: 26, tank: 22, bomber: 20, stalker: 18, sentinel: 17,
};

const MAX_ENEMIES = 256;

export type GameSimOptions = {
  /**
   * Storage backend. Defaults to localStorage.
   * Pass MemoryPersistence for ML training or tests.
   */
  store?: IPersistence;
  /**
   * Skip particle/visual effects. Dramatically speeds up headless ML rollouts.
   */
  headless?: boolean;
};

export class GameSim {
  // --- World dimensions ---
  width = 0;
  height = 0;

  // --- Game state ---
  phase: GamePhase = "menu";
  time = 0;
  score = 0;
  wave = 1;
  combo = 0;
  comboTimer = 0;
  shake = 0;
  highScore = 0;
  engineTimer = 0;
  waveTargetCount = 0;
  waveSpawnedCount = 0;
  waveSpawnTimer = 0;
  waveBreakTimer = 0;
  waveBanner = "";
  credits = 0;
  bossQueued = false;
  maxHealthPurchases = 0;
  shopOffers: ShopOffer[] = [];
  shopBlasters: ShopBlasterOffer[] = [];
  shopSkins: ShopSkinOffer[] = [];
  ownedSkins: Set<ShipSkinId> = new Set(["interceptor"]);
  ownedBlasters: Set<BlasterId> = new Set(["pulse"]);
  equippedSkin: ShipSkinId = "interceptor";
  equippedBlaster: BlasterId = "pulse";
  waveClearPending = false;
  inSandbox = false;
  roundFrozen = false;
  sandboxInvincible = true;
  consoleTimer = 5;

  // --- Entity pools (pre-allocated, zero GC after init) ---
  readonly bullets: BulletPool = createBulletPool();
  readonly particles: ParticlePool = createParticlePool();
  readonly enemies: Pool<Enemy> = new Pool<Enemy>(MAX_ENEMIES, (): Enemy => ({
    x: 0, y: 0, vx: 0, vy: 0, radius: 15, health: 10, maxHealth: 10,
    hue: 0, spin: 0, kind: "drifter", pulse: 0, timer: 0, orbitDir: 1, phase: 0,
  }));

  // Powerups are infrequent (<10 at once) — plain array is fine.
  readonly powerups: Powerup[] = [];

  readonly ambient = new AmbientField();
  readonly headless: boolean;

  player: Player = this.createPlayer();

  private readonly store: IPersistence;
  private readonly log: GameLogger;
  private readonly ambientMotion: AmbientMotion = {
    width: 0, height: 0, time: 0, player: this.player,
  };

  constructor({ store = defaultPersistence, headless = false }: GameSimOptions = {}) {
    this.store = store;
    this.headless = headless;

    this.log = createGameLogger(() => ({
      phase: this.phase, wave: this.wave, score: this.score,
      credits: this.credits, combo: this.combo, inSandbox: this.inSandbox,
    }));

    this.highScore = loadHighScore(store);
    this.ownedSkins = loadOwnedSkins(store);
    this.equippedSkin = loadEquippedSkin(this.ownedSkins, store);
    this.ownedBlasters = loadOwnedBlasters(store);
    this.equippedBlaster = loadEquippedBlaster(this.ownedBlasters, store);

    if (!headless) {
      void loadPowerupIcons();
      void loadShipSkins();
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  saveOwnedBlasters(): void {
    saveBlasterProgress(this.ownedBlasters, this.equippedBlaster, this.store);
  }

  saveOwnedSkins(): void {
    saveSkinProgress(this.ownedSkins, this.equippedSkin, this.store);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.ambient.ensureInitialized(width, height);
    if (this.phase === "menu") {
      this.player = this.createPlayer();
    }
  }

  destroy(): void {
    this.bullets.reset();
    this.enemies.reset();
    this.particles.reset();
    this.powerups.length = 0;
    this.ambient.shootingStars.length = 0;
    this.shopOffers = [];
    this.shopBlasters = [];
    this.shopSkins = [];
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  createPlayer(): Player {
    return {
      x: this.width * 0.5,
      y: this.height * 0.62,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      bank: 0,
      radius: 18,
      health: 100,
      maxHealth: 100,
      fireCooldown: 0,
      invuln: 0,
      engineGlow: 0,
      blaster: this.equippedBlaster,
      overdrive: 0,
      skin: this.equippedSkin,
    };
  }

  playerSkinSpec(): ShipSkinSpec {
    return getShipSkinSpec(this.player.skin);
  }

  nozzlePoint(): Vec2 {
    const spec = this.playerSkinSpec();
    const p = this.player;
    return {
      x: p.x - Math.cos(p.angle) * spec.engineOffset,
      y: p.y - Math.sin(p.angle) * spec.engineOffset,
    };
  }

  muzzlePoint(): Vec2 {
    const spec = this.playerSkinSpec();
    const p = this.player;
    return {
      x: p.x + Math.cos(p.aimAngle) * spec.muzzleOffset,
      y: p.y + Math.sin(p.aimAngle) * spec.muzzleOffset,
    };
  }

  waveScale(): number {
    return computeWaveScale(this.wave);
  }

  blasterLabel(): string {
    const label = formatBlasterLabel(this.player.blaster);
    return this.player.overdrive > 0 ? `${label} · OVERDRIVE` : label;
  }

  // ---------------------------------------------------------------------------
  // Phase transitions
  // ---------------------------------------------------------------------------

  togglePause(): void {
    if (this.phase === "shop") return;
    if (this.phase === "playing") {
      this.phase = "paused";
      this.log.pause();
    } else if (this.phase === "paused") {
      this.phase = this.inSandbox ? "sandbox" : "playing";
      this.log.resume();
    } else if (this.phase === "sandbox") {
      this.phase = "paused";
      this.log.pause();
    }
  }

  start(): void {
    this.phase = "playing";
    this.time = 0;
    this.score = 0;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.waveTargetCount = 0;
    this.waveSpawnedCount = 0;
    this.waveSpawnTimer = 0;
    this.waveBreakTimer = 0;
    this.waveBanner = "";
    this.credits = 0;
    this.bossQueued = false;
    this.maxHealthPurchases = 0;
    this.shopOffers = [];
    this.waveClearPending = false;
    this.inSandbox = false;
    this.roundFrozen = false;
    this.sandboxInvincible = true;
    this.bullets.reset();
    this.enemies.reset();
    this.particles.reset();
    this.powerups.length = 0;
    this.player = this.createPlayer();
    this.beginWave(true);
    this.log.gameStart();
  }

  snapshot(): GameSnapshot {
    const waveLeft = Math.max(0, this.waveTargetCount - this.waveSpawnedCount) + this.enemies.count;
    return {
      phase: this.phase,
      score: this.score,
      wave: this.wave,
      combo: this.combo,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      highScore: this.highScore,
      waveTotal: this.waveTargetCount,
      waveLeft,
      blasterLabel: this.blasterLabel(),
      waveBanner: this.waveBanner,
      credits: this.credits,
      shopBlasters: this.shopBlasters,
      shopOffers: this.shopOffers,
      shopSkins: this.shopSkins,
      inSandbox: this.inSandbox,
      roundFrozen: this.roundFrozen,
      sandboxInvincible: this.sandboxInvincible,
    };
  }

  // ---------------------------------------------------------------------------
  // Wave management
  // ---------------------------------------------------------------------------

  randomEdgePoint(): Vec2 {
    return mathRandomEdgePoint(this.width, this.height);
  }

  isBossWave(): boolean {
    return wavesIsBossWave(this.wave);
  }

  isShopWave(): boolean {
    return wavesIsShopWave(this.wave);
  }

  beginWave(initial = false): void {
    if (!initial) this.wave += 1;
    this.waveTargetCount = wavesRandomWaveCount(this.wave);
    this.bossQueued = this.isBossWave();
    if (this.isBossWave()) {
      this.waveTargetCount += Math.floor(rand(2, 5));
      this.waveBanner = `WAVE ${this.wave} · BOSS SIGNAL`;
      this.shockwave(this.width * 0.5, this.height * 0.5, 300, 0.4);
      this.shake = 14;
    } else {
      this.waveBanner = initial ? `WAVE ${this.wave}` : `WAVE ${this.wave} INCOMING`;
    }
    this.waveSpawnedCount = 0;
    this.waveSpawnTimer = initial ? 0.2 : 1.4;
    this.waveClearPending = false;
    this.log.waveStart(this.waveTargetCount, this.bossQueued);
  }

  spawnNextInWave(): void {
    if (this.waveSpawnedCount >= this.waveTargetCount) return;
    let kind = wavesPickSpawnKind(this.wave);
    if (this.bossQueued) {
      kind = "boss";
      this.bossQueued = false;
    }
    this.spawnEnemy(kind);
    this.waveSpawnedCount += 1;
    this.log.enemySpawn(kind, this.waveSpawnedCount, this.waveTargetCount);
    if (kind === "boss") {
      const e = this.enemies.buf[this.enemies.count - 1];
      this.shockwave(e.x, e.y, 300, 0.5);
      this.shake = 10;
    }
  }

  // ---------------------------------------------------------------------------
  // Shop
  // ---------------------------------------------------------------------------

  refreshShopOffers(): void {
    this.shopOffers = buildShopOffers(this.player, this.maxHealthPurchases);
  }

  refreshShopBlasters(): void {
    this.shopBlasters = buildShopBlasters(this.player, this.ownedBlasters);
  }

  refreshShopSkins(): void {
    this.shopSkins = buildShopSkins(this.player, this.ownedSkins);
  }

  buyOrEquipSkin(id: ShipSkinId): boolean {
    if (this.phase !== "shop") return false;
    if (this.player.skin === id && this.ownedSkins.has(id)) return false;
    if (!this.ownedSkins.has(id)) {
      const spec = SHIP_SKINS[id];
      if (this.credits < spec.cost) return false;
      this.credits -= spec.cost;
      this.ownedSkins.add(id);
      this.saveOwnedSkins();
      this.log.skinPurchase(id, spec.cost, false);
    } else {
      this.log.skinPurchase(id, 0, true);
    }
    this.player.skin = id;
    this.equippedSkin = id;
    this.saveOwnedSkins();
    this.refreshShopSkins();
    this.shockwave(this.width * 0.5, this.height * 0.5, SHIP_SKINS[id].thrustHue, 0.45);
    return true;
  }

  buyOrEquipBlaster(id: BlasterId): boolean {
    if (this.phase !== "shop") return false;
    if (this.player.blaster === id && this.ownedBlasters.has(id)) return false;
    if (!this.ownedBlasters.has(id)) {
      const spec = BLASTERS[id];
      if (this.credits < spec.cost) return false;
      this.credits -= spec.cost;
      this.ownedBlasters.add(id);
      this.saveOwnedBlasters();
    }
    this.player.blaster = id;
    this.equippedBlaster = id;
    this.saveOwnedBlasters();
    this.refreshShopBlasters();
    this.shockwave(this.width * 0.5, this.height * 0.5, BLASTERS[id].hue, 0.5);
    return true;
  }

  openShop(): void {
    this.phase = "shop";
    this.waveBanner = "VOID SHOP OPEN";
    this.refreshShopOffers();
    this.refreshShopBlasters();
    this.refreshShopSkins();
    this.shockwave(this.width * 0.5, this.height * 0.45, 55, 0.8);
    this.log.shopOpen();
  }

  applyShopSupport(id: ShopSupportId): void {
    this.maxHealthPurchases = applyShopSupportEffect(id, this.player, this.maxHealthPurchases);
    this.shockwave(this.width * 0.5, this.height * 0.5, 120, 0.5);
  }

  buyShopSupport(id: ShopSupportId): boolean {
    if (this.phase !== "shop") return false;
    const offer = this.shopOffers.find((item) => item.id === id);
    if (!offer || offer.soldOut || this.credits < offer.cost) return false;
    this.credits -= offer.cost;
    this.applyShopSupport(id);
    this.refreshShopOffers();
    this.log.shopPurchase(id, offer.cost, this.credits);
    return true;
  }

  buyShopItem(id: ShopSupportId): boolean {
    return this.buyShopSupport(id);
  }

  leaveShop(): void {
    if (this.phase !== "shop") return;
    this.phase = "playing";
    this.waveBanner = "";
    this.beginWave();
    this.log.shopClose();
  }

  // ---------------------------------------------------------------------------
  // Sandbox / debug
  // ---------------------------------------------------------------------------

  enterSandbox(): void {
    if (this.phase === "dead") return;
    const fromMenu = this.phase === "menu";
    this.inSandbox = true;
    this.roundFrozen = false;
    this.enemies.reset();
    this.bullets.reset();
    this.powerups.length = 0;
    this.waveBreakTimer = 0;
    this.waveClearPending = false;
    this.waveBanner = "SANDBOX MODE";
    this.sandboxInvincible = true;
    if (fromMenu) {
      this.time = 0;
      this.player = this.createPlayer();
    }
    this.player.health = this.player.maxHealth;
    this.player.invuln = 0.5;
    this.phase = "sandbox";
    this.log.sandboxEnter(fromMenu);
  }

  exitSandbox(): void {
    if (!this.inSandbox) return;
    this.inSandbox = false;
    this.roundFrozen = false;
    this.phase = "menu";
    this.waveBanner = "";
    this.enemies.reset();
    this.bullets.reset();
    this.powerups.length = 0;
    this.player = this.createPlayer();
    this.log.sandboxExit();
  }

  exitToMenu(): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    if (this.inSandbox) { this.exitSandbox(); return; }
    this.inSandbox = false;
    this.roundFrozen = false;
    this.phase = "menu";
    this.waveBanner = "";
    this.enemies.reset();
    this.bullets.reset();
    this.particles.reset();
    this.powerups.length = 0;
    this.player = this.createPlayer();
    this.log.exitToMenu();
  }

  resetSandbox(): void {
    if (!this.inSandbox) return;
    this.enemies.reset();
    this.bullets.reset();
    this.powerups.length = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.player = this.createPlayer();
    this.player.health = this.player.maxHealth;
    this.player.invuln = 0.5;
    this.sandboxInvincible = true;
    this.waveBanner = "SANDBOX MODE";
    if (this.phase === "paused") this.phase = "sandbox";
    this.log.sandboxReset();
  }

  toggleRoundFreeze(): void {
    if (this.inSandbox || this.phase === "menu" || this.phase === "dead" || this.phase === "shop") return;
    if (this.phase === "paused") this.phase = "playing";
    this.roundFrozen = !this.roundFrozen;
    if (this.roundFrozen) {
      this.enemies.reset();
      // Keep friendly bullets
      let w = 0;
      for (let r = 0; r < this.bullets.count; r++) {
        if (this.bullets.buf[r].friendly) {
          if (w !== r) { const t = this.bullets.buf[w]; this.bullets.buf[w] = this.bullets.buf[r]; this.bullets.buf[r] = t; }
          w++;
        }
      }
      this.bullets.count = w;
      this.waveBreakTimer = 0;
      this.waveBanner = "ROUND FROZEN";
    } else {
      this.waveBanner = "";
    }
    this.log.roundFreeze(this.roundFrozen);
  }

  toggleSandboxInvincible(): void {
    if (!this.inSandbox) return;
    this.sandboxInvincible = !this.sandboxInvincible;
    this.log.sandboxInvincible(this.sandboxInvincible);
  }

  debugCompleteWave(): void {
    if (this.phase !== "playing" && this.phase !== "paused") return;
    this.phase = "playing";
    this.enemies.reset();
    // Keep friendly bullets
    let w = 0;
    for (let r = 0; r < this.bullets.count; r++) {
      if (this.bullets.buf[r].friendly) {
        if (w !== r) { const t = this.bullets.buf[w]; this.bullets.buf[w] = this.bullets.buf[r]; this.bullets.buf[r] = t; }
        w++;
      }
    }
    this.bullets.count = w;
    this.waveSpawnedCount = this.waveTargetCount;
    if (this.waveClearPending) return;
    const bonus = waveClearBonus(this.wave);
    this.credits += bonus;
    this.waveClearPending = true;
    this.waveBanner = `WAVE ${this.wave} CLEARED · +${bonus} CR`;
    this.waveBreakTimer = 0.05;
  }

  debugAdvanceWave(): void {
    if (this.phase !== "playing" && this.phase !== "paused" && this.phase !== "shop") return;
    this.phase = "playing";
    this.enemies.reset();
    let w = 0;
    for (let r = 0; r < this.bullets.count; r++) {
      if (this.bullets.buf[r].friendly) {
        if (w !== r) { const t = this.bullets.buf[w]; this.bullets.buf[w] = this.bullets.buf[r]; this.bullets.buf[r] = t; }
        w++;
      }
    }
    this.bullets.count = w;
    this.waveBreakTimer = 0;
    this.waveClearPending = false;
    this.waveBanner = "";
    this.beginWave(false);
  }

  debugOpenShop(): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    this.enemies.reset();
    let w = 0;
    for (let r = 0; r < this.bullets.count; r++) {
      if (this.bullets.buf[r].friendly) {
        if (w !== r) { const t = this.bullets.buf[w]; this.bullets.buf[w] = this.bullets.buf[r]; this.bullets.buf[r] = t; }
        w++;
      }
    }
    this.bullets.count = w;
    this.waveBreakTimer = 0;
    this.waveClearPending = true;
    this.openShop();
  }

  debugGoToWave(target: number): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    this.phase = "playing";
    this.enemies.reset();
    let w = 0;
    for (let r = 0; r < this.bullets.count; r++) {
      if (this.bullets.buf[r].friendly) {
        if (w !== r) { const t = this.bullets.buf[w]; this.bullets.buf[w] = this.bullets.buf[r]; this.bullets.buf[r] = t; }
        w++;
      }
    }
    this.bullets.count = w;
    this.waveBreakTimer = 0;
    this.waveClearPending = false;
    this.wave = Math.max(1, Math.floor(target));
    this.beginWave(true);
  }

  debugAddCredits(amount: number): void {
    this.credits += Math.max(0, Math.floor(amount));
  }

  debugFullHeal(): void {
    this.player.health = this.player.maxHealth;
    this.player.invuln = 1;
  }

  debugKillAllEnemies(): void {
    if (this.phase !== "playing" && this.phase !== "paused" && this.phase !== "sandbox") return;
    while (this.enemies.count > 0) {
      this.killEnemy(this.enemies.buf[0]);
    }
  }

  debugSpawnEnemy(kind: EnemyKind): void {
    if (!this.inSandbox && !this.roundFrozen) return;
    if (this.phase !== "sandbox" && this.phase !== "playing" && this.phase !== "paused") return;
    this.spawnEnemy(kind, this.randomEdgePoint());
    this.log.debug("debug_spawn_enemy", { kind });
  }

  // ---------------------------------------------------------------------------
  // Entity helpers
  // ---------------------------------------------------------------------------

  spawnEnemy(kind: EnemyKind, at?: Vec2): void {
    const slot = this.enemies.next();
    const fresh = buildEnemy(kind, { wave: this.wave, spawn: at ?? this.randomEdgePoint() });
    Object.assign(slot, fresh);
  }

  burst(x: number, y: number, hue: number, amount: number, speed: number): void {
    if (this.headless) return;
    particleBurst(this.particles, x, y, hue, amount, speed);
  }

  shockwave(x: number, y: number, hue: number, strength = 1): void {
    if (this.headless) return;
    particleShockwave(this.particles, x, y, hue, strength);
  }

  shoot(
    from: Vec2,
    angle: number,
    friendly: boolean,
    speed: number,
    hue: number,
    pierce = 0,
    damage = 14,
    tipOffset?: number,
    radius?: number,
  ): void {
    spawnBullet(this.bullets, from, angle, friendly, speed, hue, pierce, damage, tipOffset, radius);
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

  update(dt: number, input: InputState): void {
    if (this.phase === "paused" || this.phase === "shop") {
      this.updateAmbient(dt * (this.phase === "shop" ? 0.35 : 0.15));
      return;
    }

    this.time += dt;
    if (this.phase === "sandbox") {
      this.runSandbox(dt, input);
      return;
    }

    if (this.phase !== "playing") {
      this.updateAmbient(dt);
      return;
    }
    this.runRound(dt, input);
  }

  runRound(dt: number, input: InputState): void {
    this.updateAmbient(dt);
    this.updatePlayer(dt, input);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.updateCollisions();
    this.updateWave(dt);
    if (this.player.health <= 0) {
      this.phase = "dead";
      this.shake = 22;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.highScore, this.store);
      }
      this.shockwave(this.player.x, this.player.y, 190, 1.4);
      this.burst(this.player.x, this.player.y, 190, 100, 380);
      this.log.playerDeath(this.highScore);
    }
  }

  runSandbox(dt: number, input: InputState): void {
    this.updateAmbient(dt);
    this.updatePlayer(dt, input);
    this.updateBullets(dt);
    if (this.enemies.count > 0) this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.updateCollisions();
  }

  updateAmbient(dt: number): void {
    this.ambientMotion.width = this.width;
    this.ambientMotion.height = this.height;
    this.ambientMotion.time = this.time;
    this.ambientMotion.player = this.player;
    this.ambient.update(dt, this.ambientMotion);
    if (!this.headless) tickParticles(this.particles, dt);
    this.shake = Math.max(0, this.shake - dt * 24);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.phase === "playing" || this.phase === "sandbox") {
      this.consoleTimer -= dt;
      if (this.consoleTimer <= 0) {
        this.consoleTimer = 5;
        this.log.statsTick({
          enemies: this.enemies.count,
          bullets: this.bullets.count,
          particles: this.particles.count,
          powerups: this.powerups.length,
        });
        this.log.memoryTick();
      }
    }
  }

  updatePlayer(dt: number, input: InputState): void {
    const p = this.player;
    let ix = 0;
    let iy = 0;
    if (input.keys.has("ArrowUp") || input.keys.has("KeyW")) iy -= 1;
    if (input.keys.has("ArrowDown") || input.keys.has("KeyS")) iy += 1;
    if (input.keys.has("ArrowLeft") || input.keys.has("KeyA")) ix -= 1;
    if (input.keys.has("ArrowRight") || input.keys.has("KeyD")) ix += 1;

    const maxSpeed = 560;
    const steering = expSmoothing(9.5, dt);
    const coastDrag = Math.exp(-1.35 * dt);

    if (ix !== 0 || iy !== 0) {
      const dir = normalize(ix, iy);
      p.vx += (dir.x * maxSpeed - p.vx) * steering;
      p.vy += (dir.y * maxSpeed - p.vy) * steering;
      p.engineGlow = clamp(p.engineGlow + dt * 3.5, 0, 1);
      this.engineTimer -= dt;
      if (!this.headless && this.engineTimer <= 0) {
        this.engineTimer = 0.028;
        const spec = this.playerSkinSpec();
        const spread = spec.engineSpread;
        for (const side of [-1, 1]) {
          const nozzle = {
            x: p.x - Math.cos(p.angle) * spec.engineOffset + Math.cos(p.angle + Math.PI / 2) * spread * side,
            y: p.y - Math.sin(p.angle) * spec.engineOffset + Math.sin(p.angle + Math.PI / 2) * spread * side,
          };
          this.burst(nozzle.x, nozzle.y, spec.thrustHue + this.time * 30, 2, 80 + p.engineGlow * 60);
        }
      }
    } else {
      p.vx *= coastDrag;
      p.vy *= coastDrag;
      p.engineGlow = clamp(p.engineGlow - dt * 2.5, 0, 1);
    }

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      p.vx *= scale;
      p.vy *= scale;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const bounce = 0.55;
    if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx) * bounce; }
    if (p.x > this.width - p.radius) { p.x = this.width - p.radius; p.vx = -Math.abs(p.vx) * bounce; }
    if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy) * bounce; }
    if (p.y > this.height - p.radius) { p.y = this.height - p.radius; p.vy = -Math.abs(p.vy) * bounce; }

    const targetAim = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
    p.aimAngle = lerpAngle(p.aimAngle, targetAim, expSmoothing(13, dt));
    p.angle = lerpAngle(p.angle, p.aimAngle, expSmoothing(11, dt));
    p.bank += (clamp(p.vx / maxSpeed, -1, 1) * 0.32 - p.bank) * expSmoothing(8, dt);

    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.overdrive = Math.max(0, p.overdrive - dt);

    const firing = input.mouseDown || input.keys.has("Space") || input.keys.has("KeyJ");
    if (firing && p.fireCooldown <= 0) {
      const volley = computeBlasterVolley(p.blaster, this.combo, p.overdrive);
      const muzzle = this.muzzlePoint();
      for (const shot of volley.shots) {
        this.shoot(muzzle, p.aimAngle + shot.angleOffset, true, shot.speed, shot.hue, shot.pierce, shot.damage, shot.tipOffset, shot.radius);
      }
      p.vx -= Math.cos(p.aimAngle) * volley.recoil;
      p.vy -= Math.sin(p.aimAngle) * volley.recoil;
      p.fireCooldown = volley.cooldown;
      if (!this.headless) {
        const blaster = getBlasterDef(p.blaster);
        this.burst(muzzle.x, muzzle.y, blaster.hue, 3, 90);
      }
    }
  }

  updateBullets(dt: number): void {
    tickBullets(
      this.bullets,
      this.enemies,
      dt,
      this.width,
      this.height,
      this.headless ? undefined : (bullet) => {
        if (Math.random() < dt * 16) {
          pushParticle(
            this.particles,
            bullet.x - bullet.vx * 0.012,
            bullet.y - bullet.vy * 0.012,
            rand(-20, 20), rand(-20, 20),
            0.18, bullet.hue, rand(1, 2.5), true,
          );
        }
      },
    );
  }

  updateEnemies(dt: number): void {
    const p = this.player;
    const scale = this.waveScale();
    for (let i = 0; i < this.enemies.count; i++) {
      const enemy = this.enemies.buf[i];
      enemy.pulse += dt * 3.2;
      enemy.spin += dt * 0.6;
      enemy.timer += dt;
      enemy.phase += dt * (enemy.kind === "skitter" || enemy.kind === "stalker" ? 7 : 2);
      const toPlayer = normalize(p.x - enemy.x, p.y - enemy.y);
      const distToPlayer = dist(enemy, p);

      switch (enemy.kind) {
        case "drifter":
          enemy.vx += toPlayer.x * 42 * scale * dt;
          enemy.vy += toPlayer.y * 42 * scale * dt;
          enemy.vx *= 0.985;
          enemy.vy *= 0.985;
          break;
        case "hunter": {
          const targetSpeed = (135 + this.wave * 7) * scale;
          enemy.vx += (toPlayer.x * targetSpeed - enemy.vx) * expSmoothing(6.5, dt);
          enemy.vy += (toPlayer.y * targetSpeed - enemy.vy) * expSmoothing(6.5, dt);
          break;
        }
        case "stalker": {
          const targetSpeed = (200 + this.wave * 10) * scale;
          enemy.vx += (toPlayer.x * targetSpeed - enemy.vx) * expSmoothing(9, dt);
          enemy.vy += (toPlayer.y * targetSpeed - enemy.vy) * expSmoothing(9, dt);
          break;
        }
        case "skitter": {
          const zig = Math.sin(enemy.phase) * (120 + this.wave * 4);
          const perp = { x: -toPlayer.y, y: toPlayer.x };
          enemy.vx += (toPlayer.x * 190 * scale + perp.x * zig) * dt;
          enemy.vy += (toPlayer.y * 190 * scale + perp.y * zig) * dt;
          enemy.vx *= 0.992;
          enemy.vy *= 0.992;
          break;
        }
        case "orbiter": {
          const desired = 170 + Math.sin(enemy.phase) * 30;
          const push = distToPlayer < desired ? -1 : 1;
          const tangent = { x: -toPlayer.y * enemy.orbitDir, y: toPlayer.x * enemy.orbitDir };
          enemy.vx += (toPlayer.x * 65 * push * scale + tangent.x * 130) * dt;
          enemy.vy += (toPlayer.y * 65 * push * scale + tangent.y * 130) * dt;
          enemy.vx *= 0.988;
          enemy.vy *= 0.988;
          if (enemy.timer > clamp(1.5 - this.wave * 0.04, 0.7, 1.5)) {
            enemy.timer = 0;
            this.shoot(enemy, Math.atan2(p.y - enemy.y, p.x - enemy.x), false, 300 + this.wave * 8, enemy.hue, 0, 12 + this.wave);
          }
          break;
        }
        case "sentinel": {
          enemy.vx *= 0.94;
          enemy.vy *= 0.94;
          enemy.vx += toPlayer.x * 25 * scale * dt;
          enemy.vy += toPlayer.y * 25 * scale * dt;
          if (enemy.timer > clamp(0.9 - this.wave * 0.03, 0.35, 0.9)) {
            enemy.timer = 0;
            const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
            for (let j = -1; j <= 1; j++) {
              this.shoot(enemy, angle + j * 0.12, false, 340 + this.wave * 6, enemy.hue, 0, 10 + this.wave * 0.8);
            }
          }
          break;
        }
        case "bomber":
          enemy.vx += toPlayer.x * 38 * scale * dt;
          enemy.vy += toPlayer.y * 38 * scale * dt;
          enemy.vx *= 0.99;
          enemy.vy *= 0.99;
          break;
        case "tank":
          enemy.vx += toPlayer.x * 48 * scale * dt;
          enemy.vy += toPlayer.y * 48 * scale * dt;
          enemy.vx *= 0.994;
          enemy.vy *= 0.994;
          break;
        case "phantom":
          enemy.vx *= 0.96;
          enemy.vy *= 0.96;
          if (enemy.timer > clamp(1.6 - this.wave * 0.05, 0.9, 1.6)) {
            enemy.timer = 0;
            this.burst(enemy.x, enemy.y, enemy.hue, 20, 200);
            enemy.x = clamp(p.x + rand(-120, 120), 40, this.width - 40);
            enemy.y = clamp(p.y + rand(-120, 120), 40, this.height - 40);
            this.burst(enemy.x, enemy.y, enemy.hue, 24, 240);
          } else {
            enemy.vx += toPlayer.x * 75 * scale * dt;
            enemy.vy += toPlayer.y * 75 * scale * dt;
          }
          break;
        case "splitter":
          enemy.vx += toPlayer.x * 58 * scale * dt;
          enemy.vy += toPlayer.y * 58 * scale * dt;
          enemy.vx *= 0.987;
          enemy.vy *= 0.987;
          break;
        case "boss":
          enemy.vx += toPlayer.x * 38 * scale * dt;
          enemy.vy += toPlayer.y * 38 * scale * dt;
          enemy.vx *= 0.992;
          enemy.vy *= 0.992;
          if (random() < dt * (1.5 + this.wave * 0.08)) {
            const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
            const spread = 0.12 + this.wave * 0.004;
            for (let j = -3; j <= 3; j++) {
              this.shoot(enemy, angle + j * spread, false, 310 + this.wave * 5, 330, 0, 14 + this.wave);
            }
          }
          break;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  }

  updatePowerups(dt: number): void {
    tickPowerups(this.powerups, this.player, dt, this.height, (powerup) => {
      applyPowerup(this.player, powerup.kind);
      this.shockwave(powerup.x, powerup.y, powerupHue(powerup.kind), 0.7);
      this.burst(powerup.x, powerup.y, powerupHue(powerup.kind), 24, 180);
      this.log.powerupCollect(powerup.kind);
    });
  }

  updateCollisions(): void {
    const p = this.player;
    const playerInvuln = p.invuln > 0 || (this.inSandbox && this.sandboxInvincible);

    // Friendly bullets vs enemies
    for (let bi = 0; bi < this.bullets.count; bi++) {
      const bullet = this.bullets.buf[bi];
      if (!bullet.friendly) continue;
      for (let ei = 0; ei < this.enemies.count; ei++) {
        const enemy = this.enemies.buf[ei];
        if (dist(bullet, enemy) >= enemy.radius + bullet.radius) continue;
        enemy.health -= bullet.damage;
        const killed = enemy.health <= 0;
        this.log.enemyDamage(enemy.kind, bullet.damage, enemy.health, enemy.maxHealth, killed, bullet.pierce);
        this.burst(bullet.x, bullet.y, bullet.hue, 6, 140);
        if (killed) {
          this.killEnemy(enemy);
          ei--; // enemy at position ei is now the swapped-in replacement
        }
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          bullet.life = 0;
          break;
        }
      }
    }

    // Enemy bullets vs player
    if (!playerInvuln) {
      for (let bi = 0; bi < this.bullets.count; bi++) {
        const bullet = this.bullets.buf[bi];
        if (bullet.friendly) continue;
        if (dist(bullet, p) < p.radius + bullet.radius) {
          bullet.life = 0;
          this.hitPlayer(bullet.damage, "enemy_bullet");
        }
      }
    }

    // Enemy contact vs player
    if (!playerInvuln) {
      for (let ei = 0; ei < this.enemies.count; ei++) {
        const enemy = this.enemies.buf[ei];
        if (dist(enemy, p) >= enemy.radius + p.radius) continue;
        this.hitPlayer(CONTACT_DAMAGE[enemy.kind] ?? 14, `contact:${enemy.kind}`);
        if (enemy.kind !== "boss" && enemy.kind !== "tank" && enemy.kind !== "sentinel") {
          this.killEnemy(enemy);
          ei--;
        }
      }
    }
  }

  killEnemy(enemy: Enemy): void {
    const idx = this.enemies.indexOf(enemy);
    if (idx < 0) return;
    this.enemies.removeAt(idx); // O(1) swap-and-pop

    this.combo += 1;
    this.comboTimer = 2.8;
    const points = Math.floor(ENEMY_SCORE[enemy.kind] * (1 + this.combo * 0.12));
    const creditGain = Math.floor(ENEMY_CREDITS[enemy.kind] * (1 + this.combo * 0.04));
    this.score += points;
    this.credits += creditGain;
    this.log.enemyKill(enemy.kind, points, creditGain, this.combo);

    this.shake = enemy.kind === "boss" ? 18 : enemy.kind === "tank" ? 12 : 6 + this.combo * 0.3;
    const burstAmount = enemy.kind === "boss" ? 140 : enemy.kind === "tank" ? 70 : 40 + this.combo * 2;
    const burstSpeed = enemy.kind === "boss" ? 480 : enemy.kind === "tank" ? 320 : 240 + this.combo * 8;
    this.shockwave(enemy.x, enemy.y, enemy.hue, enemy.kind === "boss" ? 1.3 : 0.85);
    this.burst(enemy.x, enemy.y, enemy.hue, burstAmount, burstSpeed);

    const drop = createPowerupDrop(enemy.x, enemy.y, enemy);
    if (drop) {
      this.powerups.push(drop);
      this.log.powerupDrop(drop.kind, enemy.kind);
    }

    if (enemy.kind === "bomber") {
      const blastRadius = 90 + this.wave * 4;
      this.shockwave(enemy.x, enemy.y, enemy.hue, 1.2);
      this.burst(enemy.x, enemy.y, enemy.hue, 80, 320);
      this.shake = 14;
      if (this.player.invuln <= 0 && dist(enemy, this.player) < blastRadius + this.player.radius) {
        this.hitPlayer(18 + this.wave, "bomber_blast");
      }
    }

    if (enemy.kind === "splitter") {
      for (let i = 0; i < 2; i++) {
        const slot = this.enemies.next();
        const child = buildEnemy("skitter", {
          wave: this.wave,
          spawn: { x: enemy.x + rand(-20, 20), y: enemy.y + rand(-20, 20) },
        });
        Object.assign(slot, child);
        slot.health = slot.maxHealth = Math.floor((6 + this.wave) * this.waveScale());
        slot.radius = 11;
      }
      this.log.splitterSpawn(2);
    }
  }

  hitPlayer(amount: number, source: string): void {
    const previousCombo = this.combo;
    this.player.health -= amount;
    this.player.invuln = 0.75;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 12;
    this.burst(this.player.x, this.player.y, 0, 24, 220);
    this.log.playerDamage(amount, source, this.player.health, this.player.maxHealth);
    this.log.comboBreak(previousCombo);
  }

  updateWave(dt: number): void {
    if (this.roundFrozen) return;
    if (this.waveBreakTimer > 0) {
      this.waveBreakTimer -= dt;
      if (this.waveBreakTimer <= 0) {
        if (this.isShopWave()) {
          this.openShop();
        } else {
          this.waveBanner = "";
          this.beginWave();
        }
      }
      return;
    }

    if (this.waveSpawnedCount < this.waveTargetCount) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        this.spawnNextInWave();
        this.waveSpawnTimer = clamp(rand(0.35, 0.85) - this.wave * 0.015, 0.18, 0.85);
      }
    }

    const waveDone = !this.waveClearPending
      && this.waveSpawnedCount >= this.waveTargetCount
      && this.enemies.count === 0;
    if (waveDone) {
      this.waveClearPending = true;
      const bonus = waveClearBonus(this.wave);
      this.credits += bonus;
      this.waveBanner = `WAVE ${this.wave} CLEARED · +${bonus} CR`;
      this.shockwave(this.width * 0.5, this.height * 0.4, 200, 1);
      this.burst(this.width * 0.5, this.height * 0.4, 200, 60, 260);
      this.waveBreakTimer = this.isShopWave() ? 1.5 : 2.2;
      this.log.waveClear(bonus);
    }
  }
}
