import type {
  Bullet,
  Enemy,
  EnemyKind,
  GamePhase,
  GameSnapshot,
  InputState,
  Particle,
  Player,
  Star,
  Vec2,
} from "./types.js";

const TAU = Math.PI * 2;
const HIGH_SCORE_KEY = "catalyx-neon-high";
const MAX_PARTICLES = 900;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return from + diff * t;
}

function expSmoothing(speed: number, dt: number): number {
  return 1 - Math.exp(-speed * dt);
}

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
  spawnTimer = 0;
  highScore = 0;
  engineTimer = 0;

  player: Player = this.createPlayer();
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  stars: Star[] = [];

  constructor() {
    try {
      this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    } catch {
      this.highScore = 0;
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.stars.length === 0) {
      this.stars = Array.from({ length: 140 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        depth: Math.random(),
        twinkle: Math.random() * TAU,
      }));
    }
    if (this.phase === "menu") {
      this.player = this.createPlayer();
    }
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
    };
  }

  togglePause(): void {
    if (this.phase === "playing") {
      this.phase = "paused";
    } else if (this.phase === "paused") {
      this.phase = "playing";
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
    this.spawnTimer = 0;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.player = this.createPlayer();
    this.spawnWave(true);
  }

  snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      wave: this.wave,
      combo: this.combo,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      highScore: this.highScore,
    };
  }

  randomEdgePoint(): Vec2 {
    const edge = Math.floor(Math.random() * 4);
    const pad = 48;
    if (edge === 0) return { x: rand(pad, this.width - pad), y: -pad };
    if (edge === 1) return { x: this.width + pad, y: rand(pad, this.height - pad) };
    if (edge === 2) return { x: rand(pad, this.width - pad), y: this.height + pad };
    return { x: -pad, y: rand(pad, this.height - pad) };
  }

  pickSpawnKind(): EnemyKind {
    const roll = Math.random();
    if (this.wave % 5 === 0 && roll < 0.08) return "boss";
    if (this.wave >= 4 && roll < 0.12) return "phantom";
    if (this.wave >= 3 && roll < 0.22) return "splitter";
    if (this.wave >= 2 && roll < 0.35) return "orbiter";
    if (roll < 0.48) return "skitter";
    if (roll < 0.62) return "hunter";
    if (roll < 0.78) return "tank";
    return "drifter";
  }

  spawnWave(initial = false): void {
    const count = initial ? 7 : 6 + this.wave * 2;
    for (let i = 0; i < count; i += 1) {
      this.enemies.push(this.createEnemy(this.pickSpawnKind()));
    }
    if (this.wave % 5 === 0) {
      this.enemies.push(this.createEnemy("boss"));
      this.shockwave(this.width * 0.5, this.height * 0.5, 300, 0.35);
      this.shake = 16;
    }
  }

  createEnemy(kind: EnemyKind, at?: Vec2): Enemy {
    const spawn = at ?? this.randomEdgePoint();
    const base = {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      spin: rand(-2, 2),
      pulse: rand(0, TAU),
      timer: rand(0, 2),
      orbitDir: Math.random() > 0.5 ? 1 : -1,
      phase: rand(0, TAU),
    };

    switch (kind) {
      case "boss":
        return { ...base, radius: 50, health: 100 + this.wave * 28, maxHealth: 100 + this.wave * 28, hue: rand(280, 320), kind };
      case "tank":
        return { ...base, radius: 28, health: 40 + this.wave * 4, maxHealth: 40 + this.wave * 4, hue: rand(20, 45), kind };
      case "hunter":
        return { ...base, radius: 20, health: 16 + this.wave * 2, maxHealth: 16 + this.wave * 2, hue: rand(155, 195), kind };
      case "skitter":
        return { ...base, radius: 13, health: 8 + this.wave, maxHealth: 8 + this.wave, hue: rand(90, 130), kind, vx: rand(-120, 120), vy: rand(-120, 120) };
      case "orbiter":
        return { ...base, radius: 18, health: 14 + this.wave * 2, maxHealth: 14 + this.wave * 2, hue: rand(200, 240), kind };
      case "splitter":
        return { ...base, radius: 19, health: 12 + this.wave * 2, maxHealth: 12 + this.wave * 2, hue: rand(300, 340), kind };
      case "phantom":
        return { ...base, radius: 17, health: 12 + this.wave * 2, maxHealth: 12 + this.wave * 2, hue: rand(260, 290), kind };
      default:
        return { ...base, radius: 15, health: 9 + this.wave, maxHealth: 9 + this.wave, hue: rand(0, 360), kind: "drifter", vx: rand(-90, 90), vy: rand(-90, 90) };
    }
  }

  addParticle(particle: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(particle);
  }

  burst(x: number, y: number, hue: number, amount: number, speed: number): void {
    for (let i = 0; i < amount; i += 1) {
      const angle = rand(0, TAU);
      const velocity = rand(speed * 0.25, speed);
      this.addParticle({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: rand(0.35, 0.95), maxLife: 0.95, hue: hue + rand(-30, 30), size: rand(1.5, 5), glow: Math.random() > 0.5 });
    }
  }

  shockwave(x: number, y: number, hue: number, strength = 1): void {
    for (let i = 0; i < 28 * strength; i += 1) {
      const angle = (i / 28) * TAU + rand(-0.08, 0.08);
      const velocity = rand(180, 340) * strength;
      this.addParticle({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: rand(0.25, 0.55), maxLife: 0.55, hue: hue + rand(-15, 15), size: rand(2.5, 6), glow: true });
    }
  }

  shoot(from: Vec2, angle: number, friendly: boolean, speed: number, hue: number, pierce = 0): void {
    this.bullets.push({
      x: from.x + Math.cos(angle) * (friendly ? 24 : 16),
      y: from.y + Math.sin(angle) * (friendly ? 24 : 16),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: friendly ? 1.6 : 2.2,
      hue,
      radius: friendly ? 4.5 : 6,
      friendly,
      pierce,
    });
  }

  update(dt: number, input: InputState): void {
    if (this.phase === "paused") {
      this.updateAmbient(dt * 0.15);
      return;
    }

    this.time += dt;
    if (this.phase !== "playing") {
      this.updateAmbient(dt);
      return;
    }
    this.updateAmbient(dt);
    this.updatePlayer(dt, input);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateCollisions();
    this.updateSpawning(dt);
    if (this.player.health <= 0) {
      this.phase = "dead";
      this.shake = 22;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try { localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore)); } catch { /* ignore */ }
      }
      this.shockwave(this.player.x, this.player.y, 190, 1.4);
      this.burst(this.player.x, this.player.y, 190, 100, 380);
    }
  }

  updateAmbient(dt: number): void {
    for (const star of this.stars) {
      star.twinkle += dt * (0.8 + star.depth);
      star.y += dt * (20 + star.depth * 60);
      if (star.y > this.height + 4) { star.y = -4; star.x = Math.random() * this.width; }
    }
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      return p.life > 0;
    });
    this.shake = Math.max(0, this.shake - dt * 24);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
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
        this.burst(p.x - dir.x * 18, p.y - dir.y * 18, 185 + this.time * 30, 2, 70 + p.engineGlow * 50);
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
      const hue = 155 + (this.combo % 7) * 28;
      const pierce = this.combo >= 5 ? 2 : this.combo >= 2 ? 1 : 0;
      const spread = this.combo >= 4 ? 0.09 : 0.045;
      this.shoot(p, p.aimAngle, true, 820, hue, pierce);
      this.shoot(p, p.aimAngle + spread, true, 800, hue + 15, pierce);
      this.shoot(p, p.aimAngle - spread, true, 800, hue - 15, pierce);
      p.vx -= Math.cos(p.aimAngle) * 14;
      p.vy -= Math.sin(p.aimAngle) * 14;
      p.fireCooldown = clamp(0.1 - this.combo * 0.004, 0.038, 0.1);
    }
  }

  updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.friendly && Math.random() < dt * 28) {
        this.addParticle({ x: bullet.x - bullet.vx * 0.012, y: bullet.y - bullet.vy * 0.012, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.18, maxLife: 0.18, hue: bullet.hue, size: rand(1, 2.5), glow: true });
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < this.width + 40 && b.y > -40 && b.y < this.height + 40);
  }

  updateEnemies(dt: number): void {
    const p = this.player;
    for (const enemy of this.enemies) {
      enemy.pulse += dt * 3.2;
      enemy.spin += dt * 0.6;
      enemy.timer += dt;
      enemy.phase += dt * (enemy.kind === "skitter" ? 6 : 2);
      const toPlayer = normalize(p.x - enemy.x, p.y - enemy.y);
      const distToPlayer = dist(enemy, p);

      switch (enemy.kind) {
        case "drifter":
          enemy.vx += toPlayer.x * 38 * dt;
          enemy.vy += toPlayer.y * 38 * dt;
          enemy.vx *= 0.985;
          enemy.vy *= 0.985;
          break;
        case "hunter": {
          const targetSpeed = 130 + this.wave * 6;
          enemy.vx += (toPlayer.x * targetSpeed - enemy.vx) * expSmoothing(6, dt);
          enemy.vy += (toPlayer.y * targetSpeed - enemy.vy) * expSmoothing(6, dt);
          break;
        }
        case "skitter": {
          const zig = Math.sin(enemy.phase) * 110;
          const perp = { x: -toPlayer.y, y: toPlayer.x };
          enemy.vx += (toPlayer.x * 180 + perp.x * zig) * dt;
          enemy.vy += (toPlayer.y * 180 + perp.y * zig) * dt;
          enemy.vx *= 0.992;
          enemy.vy *= 0.992;
          break;
        }
        case "orbiter": {
          const desired = 170 + Math.sin(enemy.phase) * 30;
          const push = distToPlayer < desired ? -1 : 1;
          const tangent = { x: -toPlayer.y * enemy.orbitDir, y: toPlayer.x * enemy.orbitDir };
          enemy.vx += (toPlayer.x * 60 * push + tangent.x * 120) * dt;
          enemy.vy += (toPlayer.y * 60 * push + tangent.y * 120) * dt;
          enemy.vx *= 0.988;
          enemy.vy *= 0.988;
          if (enemy.timer > 1.6) {
            enemy.timer = 0;
            this.shoot(enemy, Math.atan2(p.y - enemy.y, p.x - enemy.x), false, 280, enemy.hue);
          }
          break;
        }
        case "tank":
          enemy.vx += toPlayer.x * 45 * dt;
          enemy.vy += toPlayer.y * 45 * dt;
          enemy.vx *= 0.994;
          enemy.vy *= 0.994;
          break;
        case "phantom":
          enemy.vx *= 0.96;
          enemy.vy *= 0.96;
          if (enemy.timer > 1.8) {
            enemy.timer = 0;
            this.burst(enemy.x, enemy.y, enemy.hue, 20, 200);
            enemy.x = clamp(p.x + rand(-140, 140), 40, this.width - 40);
            enemy.y = clamp(p.y + rand(-140, 140), 40, this.height - 40);
            this.burst(enemy.x, enemy.y, enemy.hue, 24, 240);
          } else {
            enemy.vx += toPlayer.x * 70 * dt;
            enemy.vy += toPlayer.y * 70 * dt;
          }
          break;
        case "splitter":
          enemy.vx += toPlayer.x * 55 * dt;
          enemy.vy += toPlayer.y * 55 * dt;
          enemy.vx *= 0.987;
          enemy.vy *= 0.987;
          break;
        case "boss":
          enemy.vx += toPlayer.x * 35 * dt;
          enemy.vy += toPlayer.y * 35 * dt;
          enemy.vx *= 0.992;
          enemy.vy *= 0.992;
          if (Math.random() < dt * 1.4) {
            const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
            for (let i = -3; i <= 3; i += 1) this.shoot(enemy, angle + i * 0.14, false, 300, 330);
          }
          break;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  }

  updateCollisions(): void {
    const p = this.player;
    for (const bullet of this.bullets) {
      if (!bullet.friendly) continue;
      for (const enemy of this.enemies) {
        if (dist(bullet, enemy) >= enemy.radius + bullet.radius) continue;
        enemy.health -= 14 + this.combo * 2;
        this.burst(bullet.x, bullet.y, bullet.hue, 6, 140);
        if (enemy.health <= 0) this.killEnemy(enemy);
        if (bullet.pierce > 0) bullet.pierce -= 1;
        else bullet.life = 0;
        break;
      }
    }
    for (const bullet of this.bullets) {
      if (bullet.friendly || p.invuln > 0) continue;
      if (dist(bullet, p) < p.radius + bullet.radius) {
        bullet.life = 0;
        this.hitPlayer(10);
      }
    }
    for (const enemy of this.enemies) {
      if (p.invuln > 0 || dist(enemy, p) >= enemy.radius + p.radius) continue;
      const damage = enemy.kind === "boss" ? 24 : enemy.kind === "tank" ? 20 : 14;
      this.hitPlayer(damage);
      if (enemy.kind !== "boss" && enemy.kind !== "tank") this.killEnemy(enemy);
    }
  }

  killEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
    this.combo += 1;
    this.comboTimer = 2.8;
    const points: Record<EnemyKind, number> = { drifter: 35, skitter: 45, hunter: 75, orbiter: 90, splitter: 65, phantom: 85, tank: 120, boss: 550 };
    this.score += Math.floor(points[enemy.kind] * (1 + this.combo * 0.12));
    this.shake = enemy.kind === "boss" ? 18 : enemy.kind === "tank" ? 12 : 6 + this.combo * 0.3;
    const burstAmount = enemy.kind === "boss" ? 140 : enemy.kind === "tank" ? 70 : 40 + this.combo * 2;
    const burstSpeed = enemy.kind === "boss" ? 480 : enemy.kind === "tank" ? 320 : 240 + this.combo * 8;
    this.shockwave(enemy.x, enemy.y, enemy.hue, enemy.kind === "boss" ? 1.3 : 0.85);
    this.burst(enemy.x, enemy.y, enemy.hue, burstAmount, burstSpeed);
    if (enemy.kind === "splitter") {
      for (let i = 0; i < 2; i += 1) {
        const child = this.createEnemy("skitter", { x: enemy.x + rand(-20, 20), y: enemy.y + rand(-20, 20) });
        child.health = 6 + this.wave;
        child.maxHealth = child.health;
        child.radius = 11;
        this.enemies.push(child);
      }
    }
  }

  hitPlayer(amount: number): void {
    this.player.health -= amount;
    this.player.invuln = 0.75;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 12;
    this.burst(this.player.x, this.player.y, 0, 24, 220);
  }

  updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.enemies.length === 0) {
      this.wave += 1;
      this.spawnWave();
      this.shockwave(this.width * 0.5, this.height * 0.4, 200, 1);
      this.burst(this.width * 0.5, this.height * 0.4, 200, 60, 260);
      return;
    }
    const cap = 10 + this.wave * 2;
    if (this.spawnTimer <= 0 && this.enemies.length < cap) {
      this.enemies.push(this.createEnemy(this.pickSpawnKind()));
      this.spawnTimer = clamp(1.2 - this.wave * 0.04, 0.28, 1.2);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const shakeX = this.shake ? rand(-this.shake, this.shake) : 0;
    const shakeY = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground(ctx);
    this.drawGrid(ctx);
    for (const star of this.stars) {
      const alpha = 0.25 + Math.sin(star.twinkle) * 0.2 + star.depth * 0.35;
      ctx.fillStyle = `hsla(${200 + star.depth * 80}, 90%, 80%, ${alpha})`;
      ctx.fillRect(star.x, star.y, 1 + star.depth * 2, 1 + star.depth * 2);
    }
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
      ctx.lineTo(bullet.x - bullet.vx * 0.045, bullet.y - bullet.vy * 0.045);
      ctx.stroke();
      ctx.fillStyle = `hsla(${bullet.hue}, 100%, 85%, ${t})`;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fill();
    }
    for (const enemy of this.enemies) this.drawEnemy(ctx, enemy);
    if (this.phase !== "menu") this.drawPlayer(ctx);

    if (this.phase === "paused") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.45)";
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
    const horizon = this.height * 0.72;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(0, 255, 220, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i += 1) {
      const y = horizon + i * i * 2.2;
      if (y > this.height) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    const vanishX = this.width * 0.5;
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(vanishX + i * 40, horizon * 0.55);
      ctx.lineTo(vanishX + i * 120, this.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const blink = p.invuln > 0 && Math.floor(this.time * 22) % 2 === 0;
    const speedLen = Math.min(18, Math.hypot(p.vx, p.vy) * 0.04);

    if (p.engineGlow > 0.05) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI);
      const len = 12 + p.engineGlow * 22 + speedLen;
      ctx.fillStyle = `hsla(${180 + p.engineGlow * 40}, 100%, 60%, ${0.25 + p.engineGlow * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, len);
      ctx.lineTo(5, len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.rotate(p.bank);
    if (!blink) {
      ctx.shadowColor = "rgba(0, 255, 220, 0.85)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#eaffff";
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-15, 13);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-15, -13);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0, 255, 220, 0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    const hp = p.health / p.maxHealth;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(p.x - 26, p.y + 28, 52, 6);
    ctx.fillStyle = `hsla(${120 * hp}, 90%, 55%, 0.9)`;
    ctx.fillRect(p.x - 26, p.y + 28, 52 * hp, 6);
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
