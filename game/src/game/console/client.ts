export type GameConsoleLevel = "info" | "warn" | "error" | "debug";

export type GameLogCategory =
  | "lifecycle"
  | "wave"
  | "combat"
  | "shop"
  | "sandbox"
  | "powerup"
  | "stats"
  | "debug";

export type GameConsolePayload = {
  level: GameConsoleLevel;
  event: string;
  category?: GameLogCategory;
  phase?: string;
  wave?: number;
  score?: number;
  credits?: number;
  combo?: number;
  inSandbox?: boolean;
  data?: Record<string, unknown>;
  ts: number;
};

const DEFAULT_URL = "http://127.0.0.1:7720";

let consoleUrl = import.meta.env.VITE_GAME_CONSOLE_URL ?? DEFAULT_URL;
let enabled = import.meta.env.DEV;

export function configureGameConsole(options: { url?: string; enabled?: boolean }): void {
  if (options.url !== undefined) consoleUrl = options.url;
  if (options.enabled !== undefined) enabled = options.enabled;
}

export function isGameConsoleEnabled(): boolean {
  return enabled;
}

export function gameConsole(
  level: GameConsoleLevel,
  event: string,
  fields?: Record<string, unknown>,
): void {
  if (!enabled) return;

  const {
    category,
    phase,
    wave,
    score,
    credits,
    combo,
    inSandbox,
    ...data
  } = fields ?? {};

  const payload: GameConsolePayload = {
    level,
    event,
    ts: Date.now(),
  };

  if (category) payload.category = category as GameLogCategory;
  if (phase !== undefined) payload.phase = String(phase);
  if (typeof wave === "number") payload.wave = wave;
  if (typeof score === "number") payload.score = score;
  if (typeof credits === "number") payload.credits = credits;
  if (typeof combo === "number") payload.combo = combo;
  if (typeof inSandbox === "boolean") payload.inSandbox = inSandbox;
  if (Object.keys(data).length > 0) payload.data = data;

  fetch(`${consoleUrl}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Console server not running — ignore.
  });
}

export function gameConsoleMemory(label: string): void {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;

  if (!memory) return;

  gameConsole("debug", "memory", {
    category: "stats",
    label,
    usedMb: Math.round(memory.usedJSHeapSize / 1048576),
    totalMb: Math.round(memory.totalJSHeapSize / 1048576),
    limitMb: Math.round(memory.jsHeapSizeLimit / 1048576),
  });
}
