export type GamePhase = "menu" | "playing" | "paused" | "shop" | "sandbox" | "dead";

export type Vec2 = { x: number; y: number };

export type BlasterId = "pulse" | "rapid" | "scatter" | "lance" | "twin" | "nova";

export type ShipSkinId = "interceptor" | "needle" | "bulwark" | "phantom" | "comet";

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
  blaster: BlasterId;
  overdrive: number;
  skin: ShipSkinId;
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
  damage: number;
};

export type EnemyKind =
  | "drifter"
  | "hunter"
  | "skitter"
  | "orbiter"
  | "splitter"
  | "tank"
  | "phantom"
  | "stalker"
  | "bomber"
  | "sentinel"
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

export type PowerupKind = "rapid" | "spread" | "pierce" | "damage" | "heal" | "mega";

export type Powerup = {
  x: number;
  y: number;
  vy: number;
  radius: number;
  kind: PowerupKind;
  pulse: number;
  life: number;
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

export type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
  hue: number;
};

export type ShopSkinOffer = {
  id: ShipSkinId;
  label: string;
  detail: string;
  cost: number;
  owned: boolean;
  equipped: boolean;
};

export type ShopBlasterOffer = {
  id: BlasterId;
  label: string;
  detail: string;
  cost: number;
  owned: boolean;
  equipped: boolean;
};

export type ShopSupportId = "repair" | "maxHealth";

export type ShopOffer = {
  id: ShopSupportId;
  label: string;
  detail: string;
  cost: number;
  soldOut: boolean;
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
  waveTotal: number;
  waveLeft: number;
  blasterLabel: string;
  waveBanner: string;
  credits: number;
  shopBlasters: ShopBlasterOffer[];
  shopOffers: ShopOffer[];
  shopSkins: ShopSkinOffer[];
  inSandbox: boolean;
  roundFrozen: boolean;
  sandboxInvincible: boolean;
};
