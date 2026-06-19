import type { Player, ShootingStar, Star } from "../types.js";
import { BACKGROUND_PLANET_COUNT, STAR_FIELD_COUNT, TAU } from "../constants.js";
import { rand } from "../math.js";
import {
  createBackgroundField,
  loadPlanetImage,
  planetDrawSize,
  respawnBackgroundPlanet,
  type BackgroundPlanet,
} from "../factories/planetFactory.js";

export type AmbientMotion = {
  width: number;
  height: number;
  time: number;
  player: Player;
};

export class AmbientField {
  stars: Star[] = [];
  shootingStars: ShootingStar[] = [];
  backgroundPlanets: BackgroundPlanet[] = [];
  shootingStarTimer = 3.5;

  ensureInitialized(width: number, height: number): void {
    if (this.stars.length === 0) {
      this.stars = Array.from({ length: STAR_FIELD_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        depth: Math.random(),
        twinkle: Math.random() * TAU,
      }));
    }
    if (this.backgroundPlanets.length === 0) {
      this.backgroundPlanets = createBackgroundField(width, height, BACKGROUND_PLANET_COUNT);
      for (const planet of this.backgroundPlanets) {
        void loadPlanetImage(planet.spec);
      }
    }
  }

  update(dt: number, motion: AmbientMotion): void {
    this.updatePlanets(dt, motion);
    this.updateStars(dt, motion);
    this.updateShootingStars(dt, motion);
  }

  updatePlanets(dt: number, { width, height, time, player }: AmbientMotion): void {
    const travelX = -player.vx * 0.42;
    const travelY = -player.vy * 0.42 + 28;

    for (const planet of this.backgroundPlanets) {
      const parallax = planet.depth;
      planet.x += (travelX * parallax + Math.sin(time * 0.06 + planet.depth * 5) * 3.5) * dt;
      planet.y += (travelY * parallax + 18 + parallax * 28) * dt;

      const size = planetDrawSize(planet.spec, planet.depth);
      const margin = size * 0.7;
      if (
        planet.y > height + margin ||
        planet.x < -margin ||
        planet.x > width + margin ||
        planet.y < -margin * 2
      ) {
        const next = respawnBackgroundPlanet(
          this.backgroundPlanets,
          planet,
          width,
          height,
          { vx: player.vx, vy: player.vy },
        );
        planet.x = next.x;
        planet.y = next.y;
        planet.depth = next.depth;
        planet.spec = next.spec;
        void loadPlanetImage(planet.spec);
      }
    }
  }

  updateStars(dt: number, { width, height, time, player }: AmbientMotion): void {
    const travelX = -player.vx * 0.55;
    const travelY = -player.vy * 0.55 + 36;

    for (const star of this.stars) {
      star.twinkle += dt * (0.8 + star.depth);
      const parallax = 0.22 + star.depth * 0.78;
      star.x += (travelX * parallax + Math.sin(time * 0.12 + star.depth * 9) * 6) * dt;
      star.y += (travelY * parallax + 12 + star.depth * 48) * dt;
      this.wrapStar(star, width, height);
    }
  }

  wrapStar(star: Star, width: number, height: number): void {
    const pad = 6;
    if (star.x < -pad) star.x = width + pad;
    else if (star.x > width + pad) star.x = -pad;
    if (star.y < -pad) star.y = height + pad;
    else if (star.y > height + pad) star.y = -pad;
  }

  updateShootingStars(dt: number, motion: AmbientMotion): void {
    this.shootingStarTimer -= dt;
    if (this.shootingStarTimer <= 0) {
      this.shootingStarTimer = rand(1.8, 5.5);
      if (Math.random() > 0.25) this.spawnShootingStar(motion, false);
    }

    const speed = Math.hypot(motion.player.vx, motion.player.vy);
    if (speed > 180 && Math.random() < dt * 0.12) {
      this.spawnShootingStar(motion, true);
    }

    for (const streak of this.shootingStars) {
      streak.life -= dt;
      streak.x += streak.vx * dt;
      streak.y += streak.vy * dt;
    }
    let write = 0;
    for (let read = 0; read < this.shootingStars.length; read += 1) {
      const streak = this.shootingStars[read];
      if (streak.life > 0) {
        if (write !== read) this.shootingStars[write] = streak;
        write += 1;
      }
    }
    this.shootingStars.length = write;
  }

  spawnShootingStar(motion: AmbientMotion, fast: boolean): void {
    if (this.shootingStars.length >= 4) return;

    const { width, height, player } = motion;
    const speed = Math.hypot(player.vx, player.vy);
    let angle = rand(0.55, 1.05);
    if (speed > 40) angle = Math.atan2(-player.vy, -player.vx) + rand(-0.35, 0.35);

    const streakSpeed = rand(fast ? 680 : 480, fast ? 1180 : 920);
    const vx = Math.cos(angle) * streakSpeed;
    const vy = Math.sin(angle) * streakSpeed;
    const margin = 40;
    let x = 0;
    let y = 0;

    if (Math.abs(vx) >= Math.abs(vy)) {
      x = vx > 0 ? -margin : width + margin;
      y = rand(0, height);
    } else {
      x = rand(0, width);
      y = vy > 0 ? -margin : height + margin;
    }

    const maxLife = rand(0.45, 0.85);
    this.shootingStars.push({ x, y, vx, vy, life: maxLife, maxLife, length: rand(48, 110), hue: rand(180, 220) });
  }
}
