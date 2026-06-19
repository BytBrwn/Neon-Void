import type {
  Bullet,
  Enemy,
  EnemyKind,
  GamePhase,
  GameSnapshot,
  InputState,
  Particle,
  Player,
  Powerup,
  ShopItemId,
  ShopOffer,
  ShopSkinOffer,
  ShipSkinId,
  Vec2,
  WeaponStats,
} from "../types.js";
import { getPowerupIcon, loadPowerupIcons } from "../assets/powerupIcons.js";
import { createEnemy as buildEnemy, ENEMY_CREDITS, ENEMY_SCORE } from "../factories/enemyFactory.js";
import { createGameLogger, type GameLogger } from "../console/logger.js";
import { getShipSkinImage, getShipSkinSpec, loadShipSkins, SHIP_SKINS, type ShipSkinSpec } from "../assets/shipSkins.js";
import {
  clamp,
  dist,
  expSmoothing,
  lerpAngle,
  normalize,
  rand,
  randomEdgePoint,
  TAU,
  waveScale as computeWaveScale,
} from "../math.js";
import {
  loadEquippedSkin,
  loadHighScore,
  loadOwnedSkins,
  saveHighScore,
  saveSkinProgress,
} from "../persistence.js";
import { AmbientField } from "../systems/ambient.js";
import { enemyGravityRadius, shoot as spawnBullet, tickBullets } from "../systems/bullets.js";
import { burst, pushParticle, shockwave, tickParticles } from "../systems/particles.js";
import {
  applyPowerup,
  createPowerupDrop,
  powerupHue,
  tickPowerups,
} from "../systems/powerups.js";
import {
  applyShopItem,
  buildShopOffers,
  buildShopSkins,
  weaponLabel as formatWeaponLabel,
} from "../systems/shop.js";
import {
  isBossWave,
  isShopWave,
  pickSpawnKind,
  randomWaveCount,
  waveClearBonus,
} from "../systems/waves.js";

export class NeonEngine {
  width = 0;
  height = 0;
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
  shopSkins: ShopSkinOffer[] = [];
  ownedSkins: Set<ShipSkinId> = new Set(["interceptor"]);
  equippedSkin: ShipSkinId = "interceptor";
  waveClearPending = false;
  inSandbox = false;
  roundFrozen = false;
  sandboxInvincible = true;
  consoleTimer = 5;

  player: Player = this.createPlayer();
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  powerups: Powerup[] = [];
  readonly ambient = new AmbientField();
  private readonly log: GameLogger;

  constructor() {
    this.log = createGameLogger(() => ({
      phase: this.phase,
      wave: this.wave,
      score: this.score,
      credits: this.credits,
      combo: this.combo,
      inSandbox: this.inSandbox,
    }));
    this.highScore = loadHighScore();
    this.ownedSkins = loadOwnedSkins();
    this.equippedSkin = loadEquippedSkin(this.ownedSkins);
    void loadPowerupIcons();
    void loadShipSkins();
  }

  saveOwnedSkins(): void {
    saveSkinProgress(this.ownedSkins, this.equippedSkin);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.ambient.ensureInitialized(width, height);
    if (this.phase === "menu") {
      this.player = this.createPlayer();
    }
  }

  defaultWeapon(): WeaponStats {
    return { fireRate: 0, spread: 0, pierce: 0, damage: 0 };
  }

  createPlayer(): Player {
    return {
      x: this.width * 0.5,
      y: this.height * 0.62,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      bank: 0,
      radius: 18,
      health: 100,
      maxHealth: 100,
      fireCooldown: 0,
      invuln: 0,
      engineGlow: 0,
      weapon: this.defaultWeapon(),
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

  weaponLabel(): string {
    return formatWeaponLabel(this.player.weapon);
  }

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
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.player = this.createPlayer();
    this.beginWave(true);
    this.log.gameStart();
  }

  snapshot(): GameSnapshot {
    const waveLeft = Math.max(0, this.waveTargetCount - this.waveSpawnedCount) + this.enemies.length;
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
      weaponLabel: this.weaponLabel(),
      waveBanner: this.waveBanner,
      credits: this.credits,
      shopOffers: this.shopOffers,
      shopSkins: this.shopSkins,
      inSandbox: this.inSandbox,
      roundFrozen: this.roundFrozen,
      sandboxInvincible: this.sandboxInvincible,
    };
  }

  randomEdgePoint(): Vec2 {
    return randomEdgePoint(this.width, this.height);
  }

  randomWaveCount(): number {
    return randomWaveCount(this.wave);
  }

  pickSpawnKind(): EnemyKind {
    return pickSpawnKind(this.wave);
  }

  isBossWave(): boolean {
    return isBossWave(this.wave);
  }

  isShopWave(): boolean {
    return isShopWave(this.wave);
  }

  beginWave(initial = false): void {
    if (!initial) {
      this.wave += 1;
    }
    this.waveTargetCount = this.randomWaveCount();
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
    let kind = this.pickSpawnKind();
    if (this.bossQueued) {
      kind = "boss";
      this.bossQueued = false;
    }
    this.enemies.push(this.createEnemy(kind));
    this.waveSpawnedCount += 1;
    this.log.enemySpawn(kind, this.waveSpawnedCount, this.waveTargetCount);
    if (kind === "boss") {
      this.shockwave(this.enemies[this.enemies.length - 1].x, this.enemies[this.enemies.length - 1].y, 300, 0.5);
      this.shake = 10;
    }
  }

  refreshShopOffers(): void {
    this.shopOffers = buildShopOffers(this.player, this.maxHealthPurchases, this.wave);
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

  openShop(): void {
    this.phase = "shop";
    this.waveBanner = "VOID SHOP OPEN";
    this.refreshShopOffers();
    this.refreshShopSkins();
    this.shockwave(this.width * 0.5, this.height * 0.45, 55, 0.8);
    this.log.shopOpen();
  }

  applyShopItem(id: ShopItemId): void {
    this.maxHealthPurchases = applyShopItem(id, this.player, this.maxHealthPurchases);
    this.shockwave(this.width * 0.5, this.height * 0.5, 120, 0.5);
  }

  buyShopItem(id: ShopItemId): boolean {
    if (this.phase !== "shop") return false;
    const offer = this.shopOffers.find((item) => item.id === id);
    if (!offer || offer.soldOut || this.credits < offer.cost) return false;
    this.credits -= offer.cost;
    this.applyShopItem(id);
    this.refreshShopOffers();
    this.log.shopPurchase(id, offer.cost, this.credits);
    return true;
  }

  leaveShop(): void {
    if (this.phase !== "shop") return;
    this.phase = "playing";
    this.waveBanner = "";
    this.beginWave();
    this.log.shopClose();
  }

  /** Testing helpers — safe to strip via DEBUG_TOOLS_ENABLED in the UI. */
  debugCompleteWave(): void {
    if (this.phase !== "playing" && this.phase !== "paused") return;
    this.phase = "playing";
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.waveSpawnedCount = this.waveTargetCount;
    if (this.waveClearPending) return;
    const bonus = waveClearBonus(this.wave);
    this.credits += bonus;
    this.waveClearPending = true;
    this.waveBanner = `WAVE ${this.wave} CLEARED · +${bonus} CR`;
    this.waveBreakTimer = this.isShopWave() ? 0.05 : 0.05;
  }

  debugAdvanceWave(): void {
    if (this.phase !== "playing" && this.phase !== "paused" && this.phase !== "shop") return;
    this.phase = "playing";
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.waveBreakTimer = 0;
    this.waveClearPending = false;
    this.waveBanner = "";
    this.beginWave(false);
  }

  debugOpenShop(): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.waveBreakTimer = 0;
    this.waveClearPending = true;
    this.openShop();
  }

  debugGoToWave(target: number): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    this.phase = "playing";
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => b.friendly);
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
    while (this.enemies.length > 0) {
      this.killEnemy(this.enemies[0]);
    }
  }

  enterSandbox(): void {
    if (this.phase === "dead") return;
    const fromMenu = this.phase === "menu";
    this.inSandbox = true;
    this.roundFrozen = false;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.waveBreakTimer = 0;
    this.waveClearPending = false;
    this.waveBanner = "SANDBOX MODE";
    this.sandboxInvincible = true;
    if (fromMenu) {
      this.time = 0;
      this.player = this.createPlayer();
    } else {
      this.bullets = this.bullets.filter((b) => b.friendly);
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
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.player = this.createPlayer();
    this.log.sandboxExit();
  }

  exitToMenu(): void {
    if (this.phase === "menu" || this.phase === "dead") return;
    if (this.inSandbox) {
      this.exitSandbox();
      return;
    }
    this.inSandbox = false;
    this.roundFrozen = false;
    this.phase = "menu";
    this.waveBanner = "";
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.particles = [];
    this.player = this.createPlayer();
    this.log.exitToMenu();
  }

  resetSandbox(): void {
    if (!this.inSandbox) return;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
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
      this.enemies = [];
      this.bullets = this.bullets.filter((b) => b.friendly);
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

  debugSpawnEnemy(kind: EnemyKind): void {
    if (!this.inSandbox && !this.roundFrozen) return;
    if (this.phase !== "sandbox" && this.phase !== "playing" && this.phase !== "paused") return;
    const spawn = this.randomEdgePoint();
    this.enemies.push(this.createEnemy(kind, spawn));
    this.log.debug("debug_spawn_enemy", { kind });
  }

  createEnemy(kind: EnemyKind, at?: Vec2): Enemy {
    return buildEnemy(kind, { wave: this.wave, spawn: at ?? this.randomEdgePoint() });
  }

  addParticle(particle: Particle): void {
    pushParticle(this.particles, particle);
  }

  burst(x: number, y: number, hue: number, amount: number, speed: number): void {
    burst(this.particles, x, y, hue, amount, speed);
  }

  shockwave(x: number, y: number, hue: number, strength = 1): void {
    shockwave(this.particles, x, y, hue, strength);
  }

  shoot(from: Vec2, angle: number, friendly: boolean, speed: number, hue: number, pierce = 0, damage = 14, tipOffset?: number): void {
    spawnBullet(this.bullets, from, angle, friendly, speed, hue, pierce, damage, tipOffset);
  }

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
        saveHighScore(this.highScore);
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
    if (this.enemies.length > 0) {
      this.updateEnemies(dt);
    }
    this.updatePowerups(dt);
    this.updateCollisions();
  }

  updateAmbient(dt: number): void {
    this.ambient.update(dt, {
      width: this.width,
      height: this.height,
      time: this.time,
      player: this.player,
    });
    this.particles = tickParticles(this.particles, dt);
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
          enemies: this.enemies.length,
          bullets: this.bullets.length,
          particles: this.particles.length,
          powerups: this.powerups.length,
        });
        this.log.memoryTick();
      }
    }
  }

  drawStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.ambient.stars) {
      const alpha = 0.22 + Math.sin(star.twinkle) * 0.18 + star.depth * 0.38;
      const size = 0.8 + star.depth * 2.2;
      ctx.fillStyle = `hsla(${200 + star.depth * 80}, 90%, ${78 + star.depth * 12}%, ${alpha})`;
      ctx.fillRect(star.x, star.y, size, size);
    }
  }

  drawShootingStars(ctx: CanvasRenderingContext2D): void {
    for (const streak of this.ambient.shootingStars) {
      const t = streak.life / streak.maxLife;
      const tailX = streak.x - (streak.vx / Math.hypot(streak.vx, streak.vy)) * streak.length * t;
      const tailY = streak.y - (streak.vy / Math.hypot(streak.vx, streak.vy)) * streak.length * t;

      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = `hsla(${streak.hue}, 95%, 88%, ${0.08 * t})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();

      ctx.strokeStyle = `hsla(${streak.hue}, 100%, 92%, ${0.55 * t})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();

      ctx.fillStyle = `hsla(${streak.hue}, 100%, 96%, ${0.85 * t})`;
      ctx.shadowColor = `hsla(${streak.hue}, 100%, 80%, ${0.7 * t})`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(streak.x, streak.y, 1.6, 0, TAU);
      ctx.fill();
      ctx.restore();
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
      const targetVx = dir.x * maxSpeed;
      const targetVy = dir.y * maxSpeed;
      p.vx += (targetVx - p.vx) * steering;
      p.vy += (targetVy - p.vy) * steering;
      p.engineGlow = clamp(p.engineGlow + dt * 3.5, 0, 1);
      this.engineTimer -= dt;
      if (this.engineTimer <= 0) {
        this.engineTimer = 0.032;
        const nozzle = this.nozzlePoint();
        const spec = this.playerSkinSpec();
        this.burst(nozzle.x, nozzle.y, spec.thrustHue + this.time * 30, 2, 70 + p.engineGlow * 50);
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
    if (p.x < p.radius) {
      p.x = p.radius;
      p.vx = Math.abs(p.vx) * bounce;
    }
    if (p.x > this.width - p.radius) {
      p.x = this.width - p.radius;
      p.vx = -Math.abs(p.vx) * bounce;
    }
    if (p.y < p.radius) {
      p.y = p.radius;
      p.vy = Math.abs(p.vy) * bounce;
    }
    if (p.y > this.height - p.radius) {
      p.y = this.height - p.radius;
      p.vy = -Math.abs(p.vy) * bounce;
    }

    const targetAim = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
    p.aimAngle = lerpAngle(p.aimAngle, targetAim, expSmoothing(13, dt));
    p.angle = lerpAngle(p.angle, p.aimAngle, expSmoothing(11, dt));
    p.bank += (clamp(p.vx / maxSpeed, -1, 1) * 0.32 - p.bank) * expSmoothing(8, dt);

    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    const firing = input.mouseDown || input.keys.has("Space") || input.keys.has("KeyJ");
    if (firing && p.fireCooldown <= 0) {
      const w = p.weapon;
      const hue = 155 + (this.combo % 7) * 28;
      const comboPierce = this.combo >= 5 ? 2 : this.combo >= 2 ? 1 : 0;
      const pierce = comboPierce + w.pierce;
      const damage = 14 + this.combo * 2 + w.damage * 5;
      const spreadBase = 0.045 + w.spread * 0.035;
      const shotCount = 3 + w.spread * 2;
      const half = (shotCount - 1) / 2;
      const muzzle = this.muzzlePoint();
      for (let i = 0; i < shotCount; i += 1) {
        const offset = (i - half) * spreadBase;
        this.shoot(muzzle, p.aimAngle + offset, true, 820 - Math.abs(offset) * 120, hue + i * 6, pierce, damage, 3);
      }
      p.vx -= Math.cos(p.aimAngle) * 14;
      p.vy -= Math.sin(p.aimAngle) * 14;
      const baseCooldown = clamp(0.1 - w.fireRate * 0.016 - this.combo * 0.004, 0.028, 0.1);
      p.fireCooldown = baseCooldown;
    }
  }

  updateBullets(dt: number): void {
    this.bullets = tickBullets(
      this.bullets,
      this.enemies,
      dt,
      this.width,
      this.height,
      (bullet) => {
        if (Math.random() < dt * 28) {
          this.addParticle({
            x: bullet.x - bullet.vx * 0.012,
            y: bullet.y - bullet.vy * 0.012,
            vx: rand(-20, 20),
            vy: rand(-20, 20),
            life: 0.18,
            maxLife: 0.18,
            hue: bullet.hue,
            size: rand(1, 2.5),
            glow: true,
          });
        }
      },
    );
  }

  updateEnemies(dt: number): void {
    const p = this.player;
    const scale = this.waveScale();
    for (const enemy of this.enemies) {
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
            for (let i = -1; i <= 1; i += 1) {
              this.shoot(enemy, angle + i * 0.12, false, 340 + this.wave * 6, enemy.hue, 0, 10 + this.wave * 0.8);
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
          if (Math.random() < dt * (1.5 + this.wave * 0.08)) {
            const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
            const spread = 0.12 + this.wave * 0.004;
            for (let i = -3; i <= 3; i += 1) {
              this.shoot(enemy, angle + i * spread, false, 310 + this.wave * 5, 330, 0, 14 + this.wave);
            }
          }
          break;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  }

  dropPowerup(x: number, y: number, enemy: Enemy): void {
    const drop = createPowerupDrop(x, y, enemy);
    if (drop) {
      this.powerups.push(drop);
      this.log.powerupDrop(drop.kind, enemy.kind);
    }
  }

  collectPowerup(powerup: Powerup): void {
    applyPowerup(this.player, powerup.kind);
    this.shockwave(powerup.x, powerup.y, powerupHue(powerup.kind), 0.7);
    this.burst(powerup.x, powerup.y, powerupHue(powerup.kind), 24, 180);
    this.log.powerupCollect(powerup.kind);
  }

  updatePowerups(dt: number): void {
    this.powerups = tickPowerups(this.powerups, this.player, dt, this.height, (powerup) => {
      this.collectPowerup(powerup);
    });
  }

  explodeBomber(enemy: Enemy): void {
    const p = this.player;
    const blastRadius = 90 + this.wave * 4;
    this.shockwave(enemy.x, enemy.y, enemy.hue, 1.2);
    this.burst(enemy.x, enemy.y, enemy.hue, 80, 320);
    this.shake = 14;
    if (p.invuln <= 0 && dist(enemy, p) < blastRadius + p.radius) {
      this.hitPlayer(18 + this.wave, "bomber_blast");
    }
  }

  updateCollisions(): void {
    const p = this.player;
    const playerInvuln = p.invuln > 0 || (this.inSandbox && this.sandboxInvincible);
    for (const bullet of this.bullets) {
      if (!bullet.friendly) continue;
      for (const enemy of this.enemies) {
        if (dist(bullet, enemy) >= enemy.radius + bullet.radius) continue;
        enemy.health -= bullet.damage;
        const killed = enemy.health <= 0;
        this.log.enemyDamage(
          enemy.kind,
          bullet.damage,
          enemy.health,
          enemy.maxHealth,
          killed,
          bullet.pierce,
        );
        this.burst(bullet.x, bullet.y, bullet.hue, 6, 140);
        if (killed) this.killEnemy(enemy);
        if (bullet.pierce > 0) bullet.pierce -= 1;
        else bullet.life = 0;
        break;
      }
    }
    for (const bullet of this.bullets) {
      if (bullet.friendly || playerInvuln) continue;
      if (dist(bullet, p) < p.radius + bullet.radius) {
        bullet.life = 0;
        this.hitPlayer(bullet.damage, "enemy_bullet");
      }
    }
    for (const enemy of this.enemies) {
      if (playerInvuln || dist(enemy, p) >= enemy.radius + p.radius) continue;
      const contactDamage: Partial<Record<EnemyKind, number>> = {
        boss: 26, tank: 22, bomber: 20, stalker: 18, sentinel: 17,
      };
      this.hitPlayer(contactDamage[enemy.kind] ?? 14, `contact:${enemy.kind}`);
      if (enemy.kind !== "boss" && enemy.kind !== "tank" && enemy.kind !== "sentinel") {
        this.killEnemy(enemy);
      }
    }
  }

  killEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
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
    this.dropPowerup(enemy.x, enemy.y, enemy);
    if (enemy.kind === "bomber") this.explodeBomber(enemy);
    if (enemy.kind === "splitter") {
      for (let i = 0; i < 2; i += 1) {
        const child = this.createEnemy("skitter", { x: enemy.x + rand(-20, 20), y: enemy.y + rand(-20, 20) });
        child.health = Math.floor((6 + this.wave) * this.waveScale());
        child.maxHealth = child.health;
        child.radius = 11;
        this.enemies.push(child);
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
      && this.enemies.length === 0;
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

  draw(ctx: CanvasRenderingContext2D): void {
    const shakeX = this.shake ? rand(-this.shake, this.shake) : 0;
    const shakeY = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground(ctx);
    this.drawGrid(ctx);
    this.drawStars(ctx);
    this.drawShootingStars(ctx);
    for (const particle of this.particles) {
      const t = particle.life / particle.maxLife;
      if (particle.glow) { ctx.shadowColor = `hsla(${particle.hue}, 100%, 60%, ${t * 0.8})`; ctx.shadowBlur = 12 * t; }
      ctx.fillStyle = `hsla(${particle.hue}, 100%, ${particle.glow ? 70 : 60}%, ${t})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.5 + t * 0.5), 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const bullet of this.bullets) {
      const t = bullet.life;
      ctx.strokeStyle = `hsla(${bullet.hue}, 100%, 70%, ${0.45 * t})`;
      ctx.lineWidth = bullet.radius * 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.075, bullet.y - bullet.vy * 0.075);
      ctx.stroke();
      ctx.fillStyle = `hsla(${bullet.hue}, 100%, 85%, ${t})`;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fill();
    }
    for (const powerup of this.powerups) this.drawPowerup(ctx, powerup);
    for (const enemy of this.enemies) this.drawGravityWell(ctx, enemy);
    for (const enemy of this.enemies) this.drawEnemy(ctx, enemy);
    if (this.phase !== "menu") this.drawPlayer(ctx);
    if (this.waveBanner && this.phase === "playing") this.drawWaveBanner(ctx);

    if (this.phase === "paused") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.45)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.phase === "sandbox") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.12)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.phase === "shop") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.55)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  drawBackground(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, this.width, this.height);
    g.addColorStop(0, "#030014");
    g.addColorStop(0.5, "#0a0024");
    g.addColorStop(1, "#120030");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    const pulse = 0.5 + Math.sin(this.time * 0.8) * 0.15;
    const rg = ctx.createRadialGradient(this.width * 0.5, this.height * 0.45, 40, this.width * 0.5, this.height * 0.45, this.width * 0.55);
    rg.addColorStop(0, `rgba(120, 0, 255, ${0.12 * pulse})`);
    rg.addColorStop(0.5, `rgba(0, 255, 220, ${0.06 * pulse})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawGrid(ctx: CanvasRenderingContext2D): void {
    const cx = this.width * 0.5 - this.player.vx * 0.035;
    const cy = this.height * 1.28 - this.player.vy * 0.025;
    const radius = this.height * 0.94;
    const spin = this.time * 0.04 + this.player.vx * 0.0002;
    const latLines = 11;
    const lonLines = 22;
    const domeSpan = Math.PI * 0.54;
    const cameraTilt = 0.62;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.height * 0.38, this.width, this.height * 0.62);
    ctx.clip();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = "rgba(0, 255, 220, 0.48)";
    ctx.lineWidth = 1;

    const project = (colatitude: number, longitude: number): { x: number; y: number } | null => {
      const sinV = Math.sin(colatitude);
      const cosV = Math.cos(colatitude);
      const sinL = Math.sin(longitude);
      const cosL = Math.cos(longitude);

      let x3 = sinV * sinL;
      let y3 = cosV;
      let z3 = sinV * cosL;

      const cosS = Math.cos(spin);
      const sinS = Math.sin(spin);
      const xRot = x3 * cosS + z3 * sinS;
      const zRot = -x3 * sinS + z3 * cosS;
      const yRot = y3;

      const yCam = yRot * Math.cos(cameraTilt) - zRot * Math.sin(cameraTilt);
      const zCam = yRot * Math.sin(cameraTilt) + zRot * Math.cos(cameraTilt);

      if (zCam < -0.08) return null;

      const depth = 0.78 + zCam * 0.24;
      return {
        x: cx + xRot * radius * depth,
        y: cy - yCam * radius * depth,
      };
    };

    const drawParallel = (colatitude: number): void => {
      ctx.beginPath();
      let drawing = false;
      const steps = 64;
      for (let s = 0; s <= steps; s += 1) {
        const longitude = (s / steps) * TAU;
        const point = project(colatitude, longitude);
        if (!point || point.y > this.height + 20) {
          drawing = false;
          continue;
        }
        if (!drawing) {
          ctx.moveTo(point.x, point.y);
          drawing = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    };

    const drawMeridian = (longitude: number): void => {
      ctx.beginPath();
      let drawing = false;
      const steps = 28;
      for (let s = 0; s <= steps; s += 1) {
        const colatitude = (s / steps) * domeSpan;
        const point = project(colatitude, longitude);
        if (!point || point.y > this.height + 20) {
          drawing = false;
          continue;
        }
        if (!drawing) {
          ctx.moveTo(point.x, point.y);
          drawing = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    };

    for (let i = 1; i < latLines; i += 1) {
      drawParallel((i / latLines) * domeSpan);
    }

    for (let j = 0; j < lonLines; j += 1) {
      drawMeridian((j / lonLines) * TAU);
    }

    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = "rgba(120, 255, 230, 0.55)";
    drawParallel(domeSpan * 0.98);

    ctx.restore();
  }

  drawWaveBanner(ctx: CanvasRenderingContext2D): void {
    const alpha = 0.55 + Math.sin(this.time * 4) * 0.15;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 1.1rem system-ui, sans-serif";
    ctx.fillStyle = `rgba(180, 255, 240, ${alpha})`;
    ctx.shadowColor = "rgba(0, 255, 220, 0.45)";
    ctx.shadowBlur = 16;
    ctx.fillText(this.waveBanner, this.width * 0.5, this.height * 0.16);
    ctx.restore();
  }

  drawPowerup(ctx: CanvasRenderingContext2D, powerup: Powerup): void {
    const hue = powerupHue(powerup.kind);
    const pulse = 1 + Math.sin(powerup.pulse) * 0.1;
    const size = powerup.radius * 2.35 * pulse;
    const icon = getPowerupIcon(powerup.kind);
    const spin = Math.sin(powerup.pulse * 0.6) * 0.08;

    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.rotate(spin);

    ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.9)`;
    ctx.shadowBlur = 20 * pulse;
    ctx.strokeStyle = `hsla(${hue}, 100%, 65%, 0.4)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.52, 0, TAU);
    ctx.stroke();

    if (icon) {
      ctx.shadowBlur = 14 * pulse;
      ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${hue}, 90%, 45%, 0.35)`;
      ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.95)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.45, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const spec = this.playerSkinSpec();
    const blink = p.invuln > 0 && Math.floor(this.time * 22) % 2 === 0;
    const speedLen = Math.min(16, Math.hypot(p.vx, p.vy) * 0.035);
    const shipSize = 56;
    const half = shipSize / 2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.rotate(p.bank);

    if (p.engineGlow > 0.05) {
      const len = 8 + p.engineGlow * 18 + speedLen;
      const alpha = 0.28 + p.engineGlow * 0.42;
      ctx.save();
      ctx.translate(-spec.engineOffset, 0);
      ctx.shadowColor = `hsla(${spec.thrustHue}, 100%, 55%, ${alpha})`;
      ctx.shadowBlur = 14 + p.engineGlow * 10;
      ctx.fillStyle = `hsla(${spec.thrustHue + 20}, 100%, 62%, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-len, -5);
      ctx.lineTo(-len * 0.72, 0);
      ctx.lineTo(-len, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `hsla(${spec.thrustHue + 40}, 100%, 78%, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-len * 0.55, -2.5);
      ctx.lineTo(-len * 0.55, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (!blink) {
      const icon = getShipSkinImage(p.skin);
      if (icon) {
        ctx.shadowColor = spec.glow;
        ctx.shadowBlur = 20;
        ctx.drawImage(icon, -half, -half, shipSize, shipSize);
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = spec.glow;
        ctx.shadowBlur = 24;
        ctx.fillStyle = "#eaffff";
        ctx.strokeStyle = spec.stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spec.muzzleOffset, 0);
        ctx.lineTo(-spec.engineOffset, half * 0.45);
        ctx.lineTo(-spec.engineOffset * 0.5, 0);
        ctx.lineTo(-spec.engineOffset, -half * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawGravityWell(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    const radius = enemyGravityRadius(enemy);
    const pulse = 0.9 + Math.sin(enemy.pulse * 1.35 + enemy.phase * 0.2) * 0.1;
    const ringRadius = radius * pulse;

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.spin * 0.25 + this.time * 0.15);

    const gradient = ctx.createRadialGradient(0, 0, enemy.radius * 0.5, 0, 0, ringRadius);
    gradient.addColorStop(0, `hsla(${enemy.hue}, 95%, 58%, 0.14)`);
    gradient.addColorStop(0.45, `hsla(${enemy.hue}, 90%, 50%, 0.06)`);
    gradient.addColorStop(1, `hsla(${enemy.hue}, 85%, 45%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `hsla(${enemy.hue}, 90%, 62%, 0.16)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -this.time * 28;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * 0.92, 0, TAU);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = `hsla(${enemy.hue}, 85%, 55%, 0.1)`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const arcRadius = ringRadius * (0.38 + i * 0.2);
      const start = i * 0.65 + this.time * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, arcRadius, start, start + TAU * 0.42);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.spin + enemy.pulse * 0.15);
    ctx.scale(1 + Math.sin(enemy.pulse) * 0.07, 1 + Math.sin(enemy.pulse) * 0.07);
    const alpha = enemy.kind === "phantom" ? 0.55 + Math.sin(enemy.pulse * 2) * 0.25 : 0.95;
    ctx.shadowColor = `hsla(${enemy.hue}, 100%, 60%, 0.75)`;
    ctx.shadowBlur = enemy.kind === "boss" ? 28 : enemy.kind === "tank" ? 18 : 12;
    ctx.strokeStyle = `hsla(${enemy.hue}, 100%, 65%, ${alpha})`;
    ctx.fillStyle = `hsla(${enemy.hue}, 80%, 42%, ${0.28 * alpha})`;
    ctx.lineWidth = enemy.kind === "boss" ? 3 : enemy.kind === "tank" ? 2.5 : 2;
    ctx.beginPath();

    switch (enemy.kind) {
      case "boss":
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU;
          const r = enemy.radius * (i % 2 === 0 ? 1 : 0.72);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case "tank":
        ctx.rect(-enemy.radius, -enemy.radius * 0.85, enemy.radius * 2, enemy.radius * 1.7);
        break;
      case "hunter":
        ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
        break;
      case "skitter":
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(-enemy.radius * 0.5, enemy.radius * 0.85);
        ctx.lineTo(-enemy.radius * 0.85, 0);
        ctx.lineTo(-enemy.radius * 0.5, -enemy.radius * 0.85);
        ctx.closePath();
        break;
      case "orbiter":
        ctx.arc(0, 0, enemy.radius, 0, TAU);
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(0, enemy.radius);
        ctx.moveTo(-enemy.radius, 0);
        ctx.lineTo(enemy.radius, 0);
        break;
      case "splitter":
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * TAU - Math.PI / 2;
          const px = Math.cos(a) * enemy.radius;
          const py = Math.sin(a) * enemy.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case "phantom":
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(enemy.radius * 0.75, 0);
        ctx.lineTo(0, enemy.radius);
        ctx.lineTo(-enemy.radius * 0.75, 0);
        ctx.closePath();
        break;
      case "stalker":
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(-enemy.radius * 0.2, enemy.radius * 0.9);
        ctx.lineTo(-enemy.radius, 0);
        ctx.lineTo(-enemy.radius * 0.2, -enemy.radius * 0.9);
        ctx.closePath();
        break;
      case "bomber":
        ctx.arc(0, 0, enemy.radius, 0, TAU);
        ctx.moveTo(-enemy.radius * 0.55, -enemy.radius * 0.55);
        ctx.lineTo(enemy.radius * 0.55, enemy.radius * 0.55);
        ctx.moveTo(enemy.radius * 0.55, -enemy.radius * 0.55);
        ctx.lineTo(-enemy.radius * 0.55, enemy.radius * 0.55);
        break;
      case "sentinel":
        ctx.rect(-enemy.radius * 0.75, -enemy.radius * 0.75, enemy.radius * 1.5, enemy.radius * 1.5);
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(0, enemy.radius);
        ctx.moveTo(-enemy.radius, 0);
        ctx.lineTo(enemy.radius, 0);
        break;
      default:
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(-enemy.radius * 0.55, enemy.radius * 0.75);
        ctx.lineTo(-enemy.radius * 0.25, 0);
        ctx.lineTo(-enemy.radius * 0.55, -enemy.radius * 0.75);
        ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
