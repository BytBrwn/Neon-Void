import type { EnemyKind, GamePhase, PowerupKind, ShopItemId, ShipSkinId } from "../types.js";
import { gameConsole, gameConsoleMemory, type GameConsoleLevel } from "./client.js";

export type GameLogCategory =
  | "lifecycle"
  | "wave"
  | "combat"
  | "shop"
  | "sandbox"
  | "powerup"
  | "stats"
  | "debug";

export type GameLogContext = {
  phase: GamePhase;
  wave: number;
  score: number;
  credits: number;
  combo: number;
  inSandbox: boolean;
};

export type GameLoggerOptions = {
  /** Skip repeated combat lines within this window (ms). 0 = log every hit. */
  combatDedupeMs?: number;
};

type DedupeKey = string;

export class GameLogger {
  private combatDedupeMs: number;
  private lastCombat = new Map<DedupeKey, number>();

  constructor(
    private getContext: () => GameLogContext,
    options: GameLoggerOptions = {},
  ) {
    this.combatDedupeMs = options.combatDedupeMs ?? 0;
  }

  private emit(
    category: GameLogCategory,
    level: GameConsoleLevel,
    event: string,
    data?: Record<string, unknown>,
  ): void {
    gameConsole(level, event, {
      category,
      ...this.getContext(),
      ...data,
    });
  }

  private combat(
    event: string,
    data: Record<string, unknown>,
    level: GameConsoleLevel = "info",
  ): void {
    if (this.combatDedupeMs > 0) {
      const key = `${event}:${JSON.stringify(data)}`;
      const now = Date.now();
      const last = this.lastCombat.get(key) ?? 0;
      if (now - last < this.combatDedupeMs) return;
      this.lastCombat.set(key, now);
    }
    this.emit("combat", level, event, data);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  gameStart(): void {
    this.emit("lifecycle", "info", "game_start");
  }

  pause(): void {
    this.emit("lifecycle", "info", "pause");
  }

  resume(): void {
    this.emit("lifecycle", "info", "resume");
  }

  exitToMenu(): void {
    this.emit("lifecycle", "info", "exit_to_menu");
  }

  playerDeath(highScore: number): void {
    this.emit("lifecycle", "error", "player_death", { highScore });
  }

  // ── Wave ───────────────────────────────────────────────────────────────────

  waveStart(target: number, boss: boolean): void {
    this.emit("wave", "info", "wave_start", { target, boss });
  }

  waveClear(bonus: number): void {
    this.emit("wave", "info", "wave_clear", { bonus });
  }

  enemySpawn(kind: EnemyKind, spawned: number, target: number): void {
    this.emit("wave", "debug", "enemy_spawn", { kind, spawned, target });
  }

  roundFreeze(frozen: boolean): void {
    this.emit("wave", "warn", frozen ? "round_frozen" : "round_unfrozen");
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  playerDamage(amount: number, source: string, health: number, maxHealth: number): void {
    this.combat("player_damage", {
      amount,
      source,
      health: Math.max(0, Math.round(health)),
      maxHealth,
    }, "warn");
  }

  playerDamageBlocked(source: string, reason: string): void {
    this.combat("player_damage_blocked", { source, reason }, "debug");
  }

  enemyDamage(
    kind: EnemyKind,
    damage: number,
    health: number,
    maxHealth: number,
    killed: boolean,
    pierceLeft: number,
  ): void {
    this.combat("enemy_damage", {
      kind,
      damage,
      health: Math.max(0, Math.round(health)),
      maxHealth,
      killed,
      pierceLeft,
    });
  }

  enemyKill(
    kind: EnemyKind,
    points: number,
    credits: number,
    combo: number,
  ): void {
    this.combat("enemy_kill", { kind, points, credits, combo });
  }

  comboBreak(previous: number): void {
    if (previous > 0) {
      this.combat("combo_break", { previous }, "debug");
    }
  }

  splitterSpawn(count: number): void {
    this.combat("splitter_spawn", { count }, "debug");
  }

  // ── Shop ───────────────────────────────────────────────────────────────────

  shopOpen(): void {
    this.emit("shop", "info", "shop_open");
  }

  shopClose(): void {
    this.emit("shop", "info", "shop_close");
  }

  shopPurchase(id: ShopItemId, cost: number, creditsLeft: number): void {
    this.emit("shop", "info", "shop_purchase", { id, cost, creditsLeft });
  }

  skinPurchase(id: ShipSkinId, cost: number, equipped: boolean): void {
    this.emit("shop", "info", "skin_purchase", { id, cost, equipped });
  }

  // ── Sandbox ────────────────────────────────────────────────────────────────

  sandboxEnter(fromMenu: boolean): void {
    this.emit("sandbox", "info", "sandbox_enter", { fromMenu });
  }

  sandboxExit(): void {
    this.emit("sandbox", "info", "sandbox_exit");
  }

  sandboxReset(): void {
    this.emit("sandbox", "info", "sandbox_reset");
  }

  sandboxInvincible(enabled: boolean): void {
    this.emit("sandbox", "debug", "sandbox_invincible", { enabled });
  }

  // ── Powerups ───────────────────────────────────────────────────────────────

  powerupDrop(kind: PowerupKind, from: EnemyKind): void {
    this.emit("powerup", "info", "powerup_drop", { kind, from });
  }

  powerupCollect(kind: PowerupKind): void {
    this.emit("powerup", "info", "powerup_collect", { kind });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  statsTick(data: Record<string, number>): void {
    this.emit("stats", "debug", "stats_tick", data);
  }

  memoryTick(): void {
    gameConsoleMemory("tick");
  }

  // ── Debug tools ────────────────────────────────────────────────────────────

  debug(event: string, data?: Record<string, unknown>): void {
    this.emit("debug", "debug", event, data);
  }
}

export function createGameLogger(
  getContext: () => GameLogContext,
  options?: GameLoggerOptions,
): GameLogger {
  return new GameLogger(getContext, options);
}
