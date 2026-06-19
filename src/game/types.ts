export type GamePhase = "menu" | "playing" | "paused" | "dead";

export type Vec2 = { x: number; y: number };

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  aimAngle: number;
  bank: number;
  radius: number;
  health: number;
  maxHealth: number;
  fireCooldown: number;
  invuln: number;
  engineGlow: number;
};

export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
  radius: number;
  friendly: boolean;
  pierce: number;
};

export type EnemyKind =
  | "drifter"
  | "hunter"
  | "skitter"
  | "orbiter"
  | "splitter"
  | "tank"
  | "phantom"
  | "boss";

export type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  hue: number;
  spin: number;
  kind: EnemyKind;
  pulse: number;
  timer: number;
  orbitDir: number;
  phase: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
  glow: boolean;
};

export type Star = {
  x: number;
  y: number;
  depth: number;
  twinkle: number;
};

export type InputState = {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
};

export type GameSnapshot = {
  phase: GamePhase;
  score: number;
  wave: number;
  combo: number;
  health: number;
  maxHealth: number;
  highScore: number;
};
