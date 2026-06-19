#!/usr/bin/env node
/**
 * Neon Void terminal console
 *
 * Run (full path from any CMD):
 *   node "C:\Users\Jordab\Desktop\CATALYX\CATALYX-Widgets-repository\scripts\game-console.mjs"
 *
 * Customize via environment variables:
 *   GAME_CONSOLE_PORT=7720          — listen port
 *   GAME_CONSOLE_NO_COLOR=1         — plain text (no ANSI)
 *   GAME_CONSOLE_MIN_LEVEL=info     — hide debug (info | warn | error)
 *   GAME_CONSOLE_CATEGORIES=combat,wave — only show these categories
 *   GAME_CONSOLE_HIDE=stats         — hide categories (comma-separated)
 *
 * Colors use ANSI escape codes. Windows Terminal & VS Code terminal support them.
 * Classic CMD: run `reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f`
 * or prefer Windows Terminal for best results.
 */
import http from "node:http";

const PORT = Number(process.env.GAME_CONSOLE_PORT ?? 7720);
const HOST = process.env.GAME_CONSOLE_HOST ?? "127.0.0.1";
const NO_COLOR = process.env.GAME_CONSOLE_NO_COLOR === "1";
const MIN_LEVEL = process.env.GAME_CONSOLE_MIN_LEVEL ?? "debug";
const SHOW_CATEGORIES = process.env.GAME_CONSOLE_CATEGORIES
  ? new Set(process.env.GAME_CONSOLE_CATEGORIES.split(",").map((s) => s.trim()))
  : null;
const HIDE_CATEGORIES = new Set(
  (process.env.GAME_CONSOLE_HIDE ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

const R = NO_COLOR ? "" : "\x1b[0m";
const B = NO_COLOR ? "" : "\x1b[1m";
const DIM = NO_COLOR ? "" : "\x1b[2m";

const COLORS = {
  reset: R,
  bold: B,
  dim: DIM,
  info: NO_COLOR ? "" : "\x1b[36m",
  warn: NO_COLOR ? "" : "\x1b[33m",
  error: NO_COLOR ? "" : "\x1b[31m",
  debug: NO_COLOR ? "" : "\x1b[90m",
  white: NO_COLOR ? "" : "\x1b[97m",
  red: NO_COLOR ? "" : "\x1b[91m",
  green: NO_COLOR ? "" : "\x1b[92m",
  yellow: NO_COLOR ? "" : "\x1b[93m",
  blue: NO_COLOR ? "" : "\x1b[94m",
  magenta: NO_COLOR ? "" : "\x1b[95m",
  cyan: NO_COLOR ? "" : "\x1b[96m",
};

const CATEGORY_COLORS = {
  lifecycle: COLORS.cyan,
  wave: COLORS.blue,
  combat: COLORS.magenta,
  shop: COLORS.yellow,
  sandbox: COLORS.yellow,
  powerup: COLORS.green,
  stats: COLORS.dim,
  debug: COLORS.dim,
};

const ENEMY_KIND_COLORS = {
  boss: COLORS.red,
  tank: COLORS.yellow,
  hunter: COLORS.cyan,
  sentinel: COLORS.blue,
  bomber: COLORS.yellow,
  stalker: COLORS.magenta,
  skitter: COLORS.green,
  drifter: COLORS.dim,
  phantom: COLORS.magenta,
  splitter: COLORS.magenta,
  orbiter: COLORS.blue,
};

function paint(color, text) {
  return `${color}${text}${R}`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

function enemyKind(kind) {
  const key = String(kind ?? "?").toLowerCase();
  return paint(ENEMY_KIND_COLORS[key] ?? COLORS.white, key.toUpperCase());
}

function ctxTag(payload) {
  const parts = [];
  if (payload.phase) parts.push(payload.phase);
  if (typeof payload.wave === "number") parts.push(`W${payload.wave}`);
  if (typeof payload.combo === "number" && payload.combo > 0) {
    parts.push(paint(COLORS.yellow, `x${payload.combo}`));
  }
  if (typeof payload.score === "number") parts.push(`${payload.score}pts`);
  return parts.length ? `[${parts.join(" · ")}] ` : "";
}

function formatMessage(payload) {
  const data = payload.data ?? {};
  const { event } = payload;

  switch (event) {
    case "player_damage":
      return `${paint(COLORS.red, "PLAYER")} ${paint(COLORS.red, `−${data.amount}`)} (${paint(COLORS.dim, data.source)}) → ${paint(COLORS.green, `${data.health}/${data.maxHealth} HP`)}`;
    case "player_damage_blocked":
      return `${paint(COLORS.dim, "PLAYER blocked")} ${data.source} (${data.reason})`;
    case "enemy_damage":
      return `${enemyKind(data.kind)} ${paint(COLORS.red, `−${data.damage}`)} → ${paint(COLORS.green, `${data.health}/${data.maxHealth} HP`)}${data.killed ? paint(COLORS.red, " ☠") : ""}${data.pierceLeft ? paint(COLORS.dim, ` pierce:${data.pierceLeft}`) : ""}`;
    case "enemy_kill":
      return `${paint(COLORS.red, "KILL")} ${enemyKind(data.kind)} ${paint(COLORS.yellow, `+${data.points}pts`)} ${paint(COLORS.green, `+${data.credits}cr`)} ${paint(COLORS.yellow, `(combo x${data.combo})`)}`;
    case "combo_break":
      return paint(COLORS.dim, `combo lost (was x${data.previous})`);
    case "enemy_spawn":
      return `${paint(COLORS.blue, "spawn")} ${enemyKind(data.kind)} ${paint(COLORS.dim, `(${data.spawned}/${data.target})`)}`;
    case "wave_start":
      return `${paint(COLORS.blue, "▶ WAVE")} ${data.target} enemies${data.boss ? paint(COLORS.red, " · BOSS") : ""}`;
    case "wave_clear":
      return `${paint(COLORS.green, "✓ WAVE CLEARED")} ${paint(COLORS.yellow, `+${data.bonus} credits`)}`;
    case "powerup_drop":
      return `${paint(COLORS.green, "DROP")} ${paint(COLORS.cyan, data.kind)} ${paint(COLORS.dim, `from ${data.from}`)}`;
    case "powerup_collect":
      return `${paint(COLORS.green, "COLLECT")} ${paint(COLORS.cyan, data.kind)}`;
    case "shop_purchase":
      return `${paint(COLORS.yellow, "BOUGHT")} ${data.id} ${paint(COLORS.dim, `(−${data.cost}cr · ${data.creditsLeft} left)`)}`;
    case "skin_purchase":
      return `${paint(COLORS.yellow, data.equipped ? "EQUIP" : "BUY")} skin ${data.id}${data.cost ? paint(COLORS.dim, ` (−${data.cost}cr)`) : ""}`;
    case "stats_tick":
      return paint(COLORS.dim, `entities e:${data.enemies} b:${data.bullets} p:${data.particles} pu:${data.powerups}`);
    case "memory":
      return paint(COLORS.dim, `heap ${data.usedMb}/${data.totalMb} MB (limit ${data.limitMb})`);
    case "player_death":
      return `${paint(COLORS.red, "☠ SHIP DESTROYED")} high score ${paint(COLORS.yellow, data.highScore)}`;
    case "game_start":
      return paint(COLORS.green, "▶ GAME START");
    case "pause":
      return paint(COLORS.yellow, "⏸ PAUSED");
    case "resume":
      return paint(COLORS.green, "▶ RESUMED");
    case "exit_to_menu":
      return paint(COLORS.yellow, "← EXIT TO MENU");
    case "shop_open":
      return paint(COLORS.yellow, "🛒 SHOP OPEN");
    case "shop_close":
      return paint(COLORS.green, "🛒 SHOP CLOSED");
    case "sandbox_enter":
      return paint(COLORS.yellow, "SANDBOX ENTER");
    case "sandbox_exit":
      return paint(COLORS.yellow, "SANDBOX EXIT");
    case "sandbox_reset":
      return paint(COLORS.yellow, "SANDBOX RESET");
    default:
      if (Object.keys(data).length === 0) return event.replaceAll("_", " ");
      return `${event.replaceAll("_", " ")} ${paint(COLORS.dim, JSON.stringify(data))}`;
  }
}

function shouldPrint(payload) {
  const level = payload.level ?? "info";
  if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return false;

  const category = payload.category ?? "debug";
  if (HIDE_CATEGORIES.has(category)) return false;
  if (SHOW_CATEGORIES && !SHOW_CATEGORIES.has(category)) return false;
  return true;
}

function printLine(payload) {
  if (!shouldPrint(payload)) return;

  const level = payload.level ?? "info";
  const category = payload.category ?? "debug";
  const levelColor = COLORS[level] ?? COLORS.info;
  const catColor = CATEGORY_COLORS[category] ?? COLORS.dim;
  const time = formatTime(payload.ts ?? Date.now());
  const ctx = ctxTag(payload);
  const message = formatMessage(payload);

  console.log(
    `${DIM}${time}${R} `
    + `${levelColor}${level.toUpperCase().padEnd(5)}${R} `
    + `${catColor}${category.padEnd(9)}${R} `
    + `${DIM}${ctx}${R}`
    + `${B}${message}${R}`,
  );
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, port: PORT }));
    return;
  }

  if (req.method === "POST" && req.url === "/log") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) req.destroy();
    });
    req.on("end", () => {
      try {
        printLine(JSON.parse(body));
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end("invalid json");
      }
    });
    return;
  }

  res.writeHead(404).end("not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Neon Void console · http://${HOST}:${PORT}`);
  console.log(`Colors: ${NO_COLOR ? "OFF" : "ON"} · min level: ${MIN_LEVEL}`);
  if (SHOW_CATEGORIES) console.log(`Showing: ${[...SHOW_CATEGORIES].join(", ")}`);
  if (HIDE_CATEGORIES.size) console.log(`Hidden: ${[...HIDE_CATEGORIES].join(", ")}`);
  console.log("Categories: lifecycle · wave · combat · shop · sandbox · powerup · stats");
  console.log("Tip: set GAME_CONSOLE_HIDE=stats to hide periodic ticks\n");
});
