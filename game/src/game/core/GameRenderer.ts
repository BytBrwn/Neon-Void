/**
 * GameRenderer — all canvas drawing for the simulation.
 *
 * Reads state from GameSim but never mutates it.
 * Visual-only randomness (shake offset, particle hue jitter inside burst) uses
 * Math.random() so it never consumes the seeded simulation PRNG state.
 */

import type { Enemy, Particle, Powerup } from "../types.js";
import type { GameSim } from "./GameSim.js";
import { getPowerupIcon } from "../assets/powerupIcons.js";
import { getShipSkinImage, getShipSkinSpec } from "../assets/shipSkins.js";
import { getBlasterDef } from "../factories/blasterFactory.js";
import { getPlanetImage, planetDrawSize } from "../factories/planetFactory.js";
import { enemyGravityRadius } from "../systems/bullets.js";
import { powerupHue } from "../systems/powerups.js";
import { TAU } from "../constants.js";

export class GameRenderer {
  private bgLinearGradient: CanvasGradient | null = null;
  private bgRadialGradient: CanvasGradient | null = null;

  constructor(private readonly sim: GameSim) {}

  onResize(): void {
    this.bgLinearGradient = null;
    this.bgRadialGradient = null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sim } = this;
    // Visual shake uses Math.random() — does not affect sim PRNG
    const shakeX = sim.shake ? (Math.random() * 2 - 1) * sim.shake : 0;
    const shakeY = sim.shake ? (Math.random() * 2 - 1) * sim.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(ctx);
    this.drawBackgroundPlanets(ctx);
    this.drawStars(ctx);
    this.drawShootingStars(ctx);

    // Particles
    for (let i = 0; i < sim.particles.count; i++) {
      this.drawParticle(ctx, sim.particles.buf[i]);
    }

    // Bullets
    for (let i = 0; i < sim.bullets.count; i++) {
      const bullet = sim.bullets.buf[i];
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

    for (const powerup of sim.powerups) this.drawPowerup(ctx, powerup);
    for (let i = 0; i < sim.enemies.count; i++) this.drawGravityWell(ctx, sim.enemies.buf[i]);
    for (let i = 0; i < sim.enemies.count; i++) this.drawEnemy(ctx, sim.enemies.buf[i]);

    if (sim.phase !== "menu") this.drawPlayer(ctx);
    if (sim.waveBanner && sim.phase === "playing") this.drawWaveBanner(ctx);

    if (sim.phase === "paused") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.45)";
      ctx.fillRect(0, 0, sim.width, sim.height);
    }
    if (sim.phase === "sandbox") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.12)";
      ctx.fillRect(0, 0, sim.width, sim.height);
    }
    if (sim.phase === "shop") {
      ctx.fillStyle = "rgba(3, 0, 20, 0.55)";
      ctx.fillRect(0, 0, sim.width, sim.height);
    }

    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
    const t = particle.life / particle.maxLife;
    if (particle.glow) {
      ctx.shadowColor = `hsla(${particle.hue}, 100%, 60%, ${t * 0.8})`;
      ctx.shadowBlur = 12 * t;
    }
    ctx.fillStyle = `hsla(${particle.hue}, 100%, ${particle.glow ? 70 : 60}%, ${t})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * (0.5 + t * 0.5), 0, TAU);
    ctx.fill();
    if (particle.glow) ctx.shadowBlur = 0;
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const { sim } = this;
    if (!this.bgLinearGradient) {
      const g = ctx.createLinearGradient(0, 0, sim.width, sim.height);
      g.addColorStop(0, "#030014");
      g.addColorStop(0.5, "#0a0024");
      g.addColorStop(1, "#120030");
      this.bgLinearGradient = g;
    }
    ctx.fillStyle = this.bgLinearGradient;
    ctx.fillRect(0, 0, sim.width, sim.height);

    const pulse = 0.5 + Math.sin(sim.time * 0.8) * 0.15;
    if (!this.bgRadialGradient) {
      const rg = ctx.createRadialGradient(
        sim.width * 0.5, sim.height * 0.45, 40,
        sim.width * 0.5, sim.height * 0.45, sim.width * 0.55,
      );
      rg.addColorStop(0, "rgba(120, 0, 255, 0.12)");
      rg.addColorStop(0.5, "rgba(0, 255, 220, 0.06)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      this.bgRadialGradient = rg;
    }
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = this.bgRadialGradient;
    ctx.fillRect(0, 0, sim.width, sim.height);
    ctx.restore();
  }

  private drawBackgroundPlanets(ctx: CanvasRenderingContext2D): void {
    const planets = this.sim.ambient.backgroundPlanets;
    planets.sort((a, b) => a.depth - b.depth);
    for (const planet of planets) {
      const img = getPlanetImage(planet.spec.seed);
      if (!img) continue;
      const size = planetDrawSize(planet.spec, planet.depth);
      ctx.save();
      ctx.globalAlpha = 0.24 + planet.depth * 0.48;
      ctx.drawImage(img, planet.x - size * 0.5, planet.y - size * 0.5, size, size);
      ctx.restore();
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.sim.ambient.stars) {
      const alpha = 0.22 + Math.sin(star.twinkle) * 0.18 + star.depth * 0.38;
      const size = 0.8 + star.depth * 2.2;
      ctx.fillStyle = `hsla(${200 + star.depth * 80}, 90%, ${78 + star.depth * 12}%, ${alpha})`;
      ctx.fillRect(star.x, star.y, size, size);
    }
  }

  private drawShootingStars(ctx: CanvasRenderingContext2D): void {
    for (const streak of this.sim.ambient.shootingStars) {
      const t = streak.life / streak.maxLife;
      const speed = Math.hypot(streak.vx, streak.vy);
      const tailX = streak.x - (streak.vx / speed) * streak.length * t;
      const tailY = streak.y - (streak.vy / speed) * streak.length * t;

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

  private drawWaveBanner(ctx: CanvasRenderingContext2D): void {
    const { sim } = this;
    const alpha = 0.55 + Math.sin(sim.time * 4) * 0.15;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 1.1rem system-ui, sans-serif";
    ctx.fillStyle = `rgba(180, 255, 240, ${alpha})`;
    ctx.shadowColor = "rgba(0, 255, 220, 0.45)";
    ctx.shadowBlur = 16;
    const bannerY = sim.width <= 768 ? 100 : sim.height * 0.16;
    ctx.fillText(sim.waveBanner, sim.width * 0.5, bannerY);
    ctx.restore();
  }

  private drawPowerup(ctx: CanvasRenderingContext2D, powerup: Powerup): void {
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

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const { sim } = this;
    const p = sim.player;
    const spec = getShipSkinSpec(p.skin);
    const blaster = getBlasterDef(p.blaster);
    const blink = p.invuln > 0 && Math.floor(sim.time * 22) % 2 === 0;
    const speedLen = Math.min(20, Math.hypot(p.vx, p.vy) * 0.04);
    const shipSize = 56;
    const half = shipSize / 2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.rotate(p.bank);

    if (p.engineGlow > 0.05) {
      const len = 10 + p.engineGlow * 22 + speedLen;
      const alpha = 0.32 + p.engineGlow * 0.48;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(-spec.engineOffset, spec.engineSpread * side);
        ctx.shadowColor = `hsla(${spec.thrustHue}, 100%, 55%, ${alpha})`;
        ctx.shadowBlur = 16 + p.engineGlow * 12;
        const grad = ctx.createLinearGradient(0, 0, -len, 0);
        grad.addColorStop(0, `hsla(${spec.thrustHue + 35}, 100%, 82%, ${alpha})`);
        grad.addColorStop(0.45, `hsla(${spec.thrustHue + 10}, 100%, 58%, ${alpha * 0.85})`);
        grad.addColorStop(1, `hsla(${spec.thrustHue}, 95%, 42%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-len, -4.5);
        ctx.lineTo(-len * 0.65, 0);
        ctx.lineTo(-len, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
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

      const aimDelta = p.aimAngle - p.angle;
      ctx.save();
      ctx.rotate(aimDelta);
      ctx.fillStyle = `hsla(${blaster.hue}, 90%, 55%, 0.55)`;
      ctx.strokeStyle = `hsla(${blaster.hue}, 100%, 72%, 0.95)`;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = `hsla(${blaster.hue}, 100%, 60%, 0.8)`;
      ctx.shadowBlur = p.overdrive > 0 ? 16 : 10;
      ctx.beginPath();
      const bx = spec.muzzleOffset - 2;
      const by = -blaster.barrelWidth * 0.5;
      const bw = blaster.barrelLength;
      const bh = blaster.barrelWidth;
      const br = 2;
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by, bx + br, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `hsla(${blaster.hue}, 100%, 88%, ${0.7 + (p.overdrive > 0 ? 0.2 : 0)})`;
      ctx.beginPath();
      ctx.arc(spec.muzzleOffset + blaster.barrelLength, 0, blaster.barrelWidth * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawGravityWell(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    const { sim } = this;
    const radius = enemyGravityRadius(enemy);
    const pulse = 0.9 + Math.sin(enemy.pulse * 1.35 + enemy.phase * 0.2) * 0.1;
    const ringRadius = radius * pulse;

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.spin * 0.25 + sim.time * 0.15);

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
    ctx.lineDashOffset = -sim.time * 28;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * 0.92, 0, TAU);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = `hsla(${enemy.hue}, 85%, 55%, 0.1)`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const arcRadius = ringRadius * (0.38 + i * 0.2);
      const start = i * 0.65 + sim.time * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, arcRadius, start, start + TAU * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
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
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const r = enemy.radius * (i % 2 === 0 ? 1 : 0.72);
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
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
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * enemy.radius, Math.sin(a) * enemy.radius);
          else ctx.lineTo(Math.cos(a) * enemy.radius, Math.sin(a) * enemy.radius);
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
