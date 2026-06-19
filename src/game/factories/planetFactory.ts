import { MAX_PLANET_IMAGES } from "../constants.js";

const PLANET_VIEW = 128;

export type PlanetArchetype =
  | "rocky"
  | "gasGiant"
  | "ice"
  | "lava"
  | "desert"
  | "ocean"
  | "dwarf"
  | "ringed"
  | "toxic";

export type PlanetSpec = {
  seed: number;
  archetype: PlanetArchetype;
  radius: number;
  hue: number;
  hueShift: number;
  saturation: number;
  lightness: number;
  hasRing: boolean;
  ringTilt: number;
  ringWidth: number;
  hasStripes: boolean;
  stripeCount: number;
  craterCount: number;
  atmosphere: number;
  hasMoon: boolean;
  moonOrbit: number;
  moonSize: number;
  cloudSpots: number;
  continentCount: number;
};

export type BackgroundPlanet = {
  x: number;
  y: number;
  depth: number;
  spec: PlanetSpec;
};

const ARCHETYPES: PlanetArchetype[] = [
  "rocky",
  "gasGiant",
  "ice",
  "lava",
  "desert",
  "ocean",
  "dwarf",
  "ringed",
  "toxic",
];

const ARCHETYPE_WEIGHTS: Record<PlanetArchetype, number> = {
  rocky: 1.1,
  gasGiant: 0.95,
  ice: 0.85,
  lava: 0.55,
  desert: 0.9,
  ocean: 0.8,
  dwarf: 0.75,
  ringed: 0.45,
  toxic: 0.5,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng: () => number, items: PlanetArchetype[]): PlanetArchetype {
  const total = items.reduce((sum, item) => sum + ARCHETYPE_WEIGHTS[item], 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= ARCHETYPE_WEIGHTS[item];
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randSigned(rng: () => number, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

function archetypeProfile(archetype: PlanetArchetype, rng: () => number): Omit<PlanetSpec, "seed" | "archetype"> {
  switch (archetype) {
    case "gasGiant":
      return {
        radius: 42 + rng() * 46,
        hue: 180 + rng() * 140,
        hueShift: 18 + rng() * 24,
        saturation: 52 + rng() * 32,
        lightness: 36 + rng() * 18,
        hasRing: rng() > 0.82,
        ringTilt: rng() * 40 - 20,
        ringWidth: 0.1 + rng() * 0.08,
        hasStripes: true,
        stripeCount: 5 + Math.floor(rng() * 6),
        craterCount: 0,
        atmosphere: 0.42 + rng() * 0.35,
        hasMoon: rng() > 0.55,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 5 + rng() * 4,
        cloudSpots: 2 + Math.floor(rng() * 4),
        continentCount: 0,
      };
    case "ice":
      return {
        radius: 30 + rng() * 38,
        hue: 190 + rng() * 40,
        hueShift: 8 + rng() * 12,
        saturation: 28 + rng() * 28,
        lightness: 58 + rng() * 18,
        hasRing: rng() > 0.88,
        ringTilt: rng() * 24 - 12,
        ringWidth: 0.1 + rng() * 0.06,
        hasStripes: rng() > 0.7,
        stripeCount: 2 + Math.floor(rng() * 3),
        craterCount: Math.floor(rng() * 3),
        atmosphere: 0.5 + rng() * 0.35,
        hasMoon: rng() > 0.62,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 4 + rng() * 3,
        cloudSpots: 0,
        continentCount: 0,
      };
    case "lava":
      return {
        radius: 28 + rng() * 34,
        hue: 8 + rng() * 28,
        hueShift: 22 + rng() * 18,
        saturation: 72 + rng() * 24,
        lightness: 28 + rng() * 16,
        hasRing: false,
        ringTilt: 0,
        ringWidth: 0.12,
        hasStripes: false,
        stripeCount: 0,
        craterCount: 1 + Math.floor(rng() * 3),
        atmosphere: 0.34 + rng() * 0.28,
        hasMoon: rng() > 0.78,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 3 + rng() * 3,
        cloudSpots: 0,
        continentCount: 0,
      };
    case "desert":
      return {
        radius: 32 + rng() * 36,
        hue: 28 + rng() * 34,
        hueShift: 12 + rng() * 16,
        saturation: 46 + rng() * 30,
        lightness: 42 + rng() * 18,
        hasRing: false,
        ringTilt: 0,
        ringWidth: 0.12,
        hasStripes: rng() > 0.45,
        stripeCount: 2 + Math.floor(rng() * 4),
        craterCount: 1 + Math.floor(rng() * 4),
        atmosphere: 0.22 + rng() * 0.24,
        hasMoon: rng() > 0.7,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 4 + rng() * 3,
        cloudSpots: 0,
        continentCount: 0,
      };
    case "ocean":
      return {
        radius: 34 + rng() * 40,
        hue: 198 + rng() * 36,
        hueShift: 14 + rng() * 16,
        saturation: 58 + rng() * 28,
        lightness: 34 + rng() * 16,
        hasRing: false,
        ringTilt: 0,
        ringWidth: 0.12,
        hasStripes: false,
        stripeCount: 0,
        craterCount: 0,
        atmosphere: 0.48 + rng() * 0.38,
        hasMoon: rng() > 0.48,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 5 + rng() * 4,
        cloudSpots: 1 + Math.floor(rng() * 3),
        continentCount: 2 + Math.floor(rng() * 4),
      };
    case "dwarf":
      return {
        radius: 16 + rng() * 18,
        hue: rng() * 360,
        hueShift: rng() * 20 - 10,
        saturation: 18 + rng() * 28,
        lightness: 42 + rng() * 20,
        hasRing: false,
        ringTilt: 0,
        ringWidth: 0.12,
        hasStripes: false,
        stripeCount: 0,
        craterCount: 2 + Math.floor(rng() * 5),
        atmosphere: 0.08 + rng() * 0.12,
        hasMoon: false,
        moonOrbit: 0,
        moonSize: 0,
        cloudSpots: 0,
        continentCount: 0,
      };
    case "ringed":
      return {
        radius: 38 + rng() * 42,
        hue: 210 + rng() * 100,
        hueShift: 16 + rng() * 20,
        saturation: 40 + rng() * 34,
        lightness: 38 + rng() * 18,
        hasRing: true,
        ringTilt: rng() * 50 - 25,
        ringWidth: 0.11 + rng() * 0.12,
        hasStripes: rng() > 0.35,
        stripeCount: 3 + Math.floor(rng() * 4),
        craterCount: Math.floor(rng() * 2),
        atmosphere: 0.36 + rng() * 0.3,
        hasMoon: rng() > 0.58,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 4 + rng() * 4,
        cloudSpots: 0,
        continentCount: 0,
      };
    case "toxic":
      return {
        radius: 30 + rng() * 32,
        hue: 95 + rng() * 55,
        hueShift: 28 + rng() * 22,
        saturation: 62 + rng() * 30,
        lightness: 32 + rng() * 14,
        hasRing: rng() > 0.9,
        ringTilt: rng() * 20 - 10,
        ringWidth: 0.1 + rng() * 0.08,
        hasStripes: true,
        stripeCount: 3 + Math.floor(rng() * 3),
        craterCount: 0,
        atmosphere: 0.58 + rng() * 0.35,
        hasMoon: rng() > 0.72,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 3 + rng() * 3,
        cloudSpots: 1 + Math.floor(rng() * 2),
        continentCount: 0,
      };
    default:
      return {
        radius: 28 + rng() * 40,
        hue: rng() * 360,
        hueShift: rng() * 30 - 15,
        saturation: 34 + rng() * 36,
        lightness: 32 + rng() * 22,
        hasRing: rng() > 0.84,
        ringTilt: rng() * 30 - 15,
        ringWidth: 0.11 + rng() * 0.09,
        hasStripes: rng() > 0.62,
        stripeCount: 0,
        craterCount: 1 + Math.floor(rng() * 6),
        atmosphere: 0.2 + rng() * 0.32,
        hasMoon: rng() > 0.66,
        moonOrbit: rng() * Math.PI * 2,
        moonSize: 4 + rng() * 4,
        cloudSpots: 0,
        continentCount: 0,
      };
  }
}

export function createPlanetSpec(seed: number): PlanetSpec {
  const rng = mulberry32(seed);
  const archetype = pickWeighted(rng, ARCHETYPES);
  return {
    seed: seed >>> 0,
    archetype,
    ...archetypeProfile(archetype, rng),
  };
}

export function planetDepth(spec: PlanetSpec): number {
  const sizeFactor = spec.archetype === "dwarf" ? 0.08 : (spec.radius / 88) * 0.38;
  return clamp(0.1 + sizeFactor, 0.1, 0.52);
}

export function planetDrawSize(spec: PlanetSpec, depth: number): number {
  const scale = spec.archetype === "dwarf" ? 0.72 : spec.archetype === "gasGiant" || spec.archetype === "ringed" ? 1.08 : 1;
  return spec.radius * (0.52 + depth * 0.72) * 2 * scale;
}

function minPlanetSeparation(sizeA: number, sizeB: number): number {
  return Math.max(sizeA, sizeB) * 1.55 + 180;
}

function isSpaced(x: number, y: number, size: number, others: BackgroundPlanet[]): boolean {
  for (const other of others) {
    const otherSize = planetDrawSize(other.spec, other.depth);
    const gap = minPlanetSeparation(size, otherSize);
    const dx = x - other.x;
    const dy = y - other.y;
    if (dx * dx + dy * dy < gap * gap) return false;
  }
  return true;
}

function buildPlanetSvg(spec: PlanetSpec): string {
  const rng = mulberry32(spec.seed ^ 0x9e3779b9);
  const cx = PLANET_VIEW * 0.5;
  const cy = PLANET_VIEW * 0.5;
  const bodyR = spec.archetype === "dwarf" ? 28 : spec.archetype === "gasGiant" || spec.archetype === "ringed" ? 41 : 38;
  const uid = spec.seed.toString(16);

  const core = `hsl(${spec.hue}, ${spec.saturation}%, ${spec.lightness}%)`;
  const shadow = `hsl(${spec.hue + spec.hueShift}, ${spec.saturation}%, ${Math.max(10, spec.lightness - 18)}%)`;
  const highlight = `hsl(${spec.hue - spec.hueShift * 0.45}, ${Math.max(18, spec.saturation - 8)}%, ${Math.min(78, spec.lightness + 16)}%)`;
  const atmosphere = `hsla(${spec.hue + 12}, ${spec.saturation}%, ${spec.lightness + 18}%, ${spec.atmosphere * 0.38})`;

  let stripes = "";
  if (spec.hasStripes) {
    for (let i = 0; i < spec.stripeCount; i += 1) {
      const t = (i + 0.5) / spec.stripeCount;
      const y = cy - bodyR + t * bodyR * 2;
      const stripeHue = spec.hue + (i % 2 === 0 ? spec.hueShift : -spec.hueShift * 0.6);
      const alpha = 0.1 + rng() * 0.18;
      stripes += `<ellipse cx="${cx}" cy="${y.toFixed(1)}" rx="${(bodyR * (0.78 + rng() * 0.14)).toFixed(1)}" ry="${(2 + rng() * 4.2).toFixed(1)}" fill="hsla(${stripeHue}, ${spec.saturation}%, ${spec.lightness - 8}%, ${alpha.toFixed(3)})"/>`;
    }
  }

  let craters = "";
  for (let i = 0; i < spec.craterCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * bodyR * 0.64;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist * 0.88;
    const craterR = 1.8 + rng() * (spec.archetype === "dwarf" ? 4.5 : 6.5);
    craters += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${craterR.toFixed(1)}" fill="hsla(${spec.hue + spec.hueShift}, ${spec.saturation}%, ${Math.max(8, spec.lightness - 24)}%, ${(0.2 + rng() * 0.2).toFixed(3)})"/>`;
  }

  let continents = "";
  for (let i = 0; i < spec.continentCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * bodyR * 0.42;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist * 0.82;
    continents += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(6 + rng() * 10).toFixed(1)}" ry="${(4 + rng() * 8).toFixed(1)}" transform="rotate(${(angle * 57.3).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" fill="hsla(${110 + rng() * 30}, ${42 + rng() * 20}%, ${34 + rng() * 12}%, ${(0.28 + rng() * 0.18).toFixed(3)})"/>`;
  }

  let cloudSpots = "";
  for (let i = 0; i < spec.cloudSpots; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * bodyR * 0.55;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist * 0.75;
    cloudSpots += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(8 + rng() * 8).toFixed(1)}" ry="${(3 + rng() * 4).toFixed(1)}" fill="hsla(${spec.hue + 10}, ${Math.max(12, spec.saturation - 20)}%, ${spec.lightness + 28}%, ${(0.14 + rng() * 0.12).toFixed(3)})"/>`;
  }

  let lavaCracks = "";
  if (spec.archetype === "lava") {
    for (let i = 0; i < 4 + Math.floor(rng() * 3); i += 1) {
      const angle = rng() * Math.PI * 2;
      const inner = bodyR * (0.12 + rng() * 0.2);
      const outer = bodyR * (0.55 + rng() * 0.35);
      const x1 = cx + Math.cos(angle) * inner;
      const y1 = cy + Math.sin(angle) * inner * 0.88;
      const x2 = cx + Math.cos(angle + randSigned(rng, 0.35)) * outer;
      const y2 = cy + Math.sin(angle + randSigned(rng, 0.35)) * outer * 0.88;
      lavaCracks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="hsla(${22 + rng() * 18}, 100%, ${58 + rng() * 16}%, ${(0.45 + rng() * 0.25).toFixed(3)})" stroke-width="${(1.2 + rng() * 1.4).toFixed(1)}" stroke-linecap="round"/>`;
    }
  }

  let iceCap = "";
  if (spec.archetype === "ice") {
    iceCap = `<path d="M${cx - bodyR} ${cy - bodyR * 0.05} A ${bodyR} ${bodyR} 0 0 1 ${cx + bodyR} ${cy - bodyR * 0.05} L ${cx + bodyR * 0.72} ${cy - bodyR * 0.72} Q ${cx} ${cy - bodyR * 0.92} ${cx - bodyR * 0.72} ${cy - bodyR * 0.72} Z" fill="hsla(${200 + rng() * 20}, ${18 + rng() * 16}%, ${82 + rng() * 10}%, 0.72)"/>`;
  }

  let toxicVeil = "";
  if (spec.archetype === "toxic") {
    toxicVeil = `<circle cx="${cx}" cy="${cy}" r="${(bodyR + 4).toFixed(1)}" fill="hsla(${spec.hue + 40}, ${spec.saturation}%, ${spec.lightness + 10}%, 0.12)"/>`;
  }

  const ringMarkup = spec.hasRing
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${(bodyR + 8).toFixed(1)}" ry="${(bodyR * spec.ringWidth + 4).toFixed(1)}" transform="rotate(${spec.ringTilt.toFixed(1)} ${cx} ${cy})" fill="none" stroke="hsla(${spec.hue + 20}, ${Math.max(18, spec.saturation - 10)}%, ${spec.lightness + 24}%, 0.42)" stroke-width="3.2"/>
       <ellipse cx="${cx}" cy="${cy}" rx="${(bodyR + 13).toFixed(1)}" ry="${(bodyR * spec.ringWidth + 6).toFixed(1)}" transform="rotate(${spec.ringTilt.toFixed(1)} ${cx} ${cy})" fill="none" stroke="hsla(${spec.hue}, ${spec.saturation}%, ${spec.lightness + 30}%, 0.16)" stroke-width="1.4"/>`
    : "";

  let moonMarkup = "";
  if (spec.hasMoon) {
    const mx = cx + Math.cos(spec.moonOrbit) * (bodyR + 16);
    const my = cy + Math.sin(spec.moonOrbit) * (bodyR + 12);
    moonMarkup = `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${spec.moonSize.toFixed(1)}" fill="hsla(${spec.hue - 12}, ${Math.max(12, spec.saturation - 18)}%, ${spec.lightness + 8}%, 0.82)"/>`;
  }

  const shade = pick(rng, ["left", "right"] as const);
  const lightX = shade === "left" ? "28%" : "72%";
  const lightY = shade === "left" ? "36%" : "64%";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLANET_VIEW} ${PLANET_VIEW}" width="${PLANET_VIEW}" height="${PLANET_VIEW}">
    <defs>
      <radialGradient id="pg-${uid}" cx="${lightX}" cy="${lightY}" r="68%">
        <stop offset="0%" stop-color="${highlight}"/>
        <stop offset="55%" stop-color="${core}"/>
        <stop offset="100%" stop-color="${shadow}"/>
      </radialGradient>
      <radialGradient id="pa-${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="72%" stop-color="${atmosphere}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${atmosphere}"/>
      </radialGradient>
      <clipPath id="pc-${uid}">
        <circle cx="${cx}" cy="${cy}" r="${bodyR}"/>
      </clipPath>
    </defs>
    ${moonMarkup}
    ${ringMarkup}
    <circle cx="${cx}" cy="${cy}" r="${(bodyR + 7).toFixed(1)}" fill="url(#pa-${uid})"/>
    <g clip-path="url(#pc-${uid})">
      <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="url(#pg-${uid})"/>
      ${continents}
      ${stripes}
      ${cloudSpots}
      ${iceCap}
      ${lavaCracks}
      ${craters}
      ${toxicVeil}
    </g>
    <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="none" stroke="hsla(${spec.hue}, ${spec.saturation}%, ${spec.lightness + 20}%, 0.12)" stroke-width="1"/>
  </svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const planetImages = new Map<number, HTMLImageElement>();
const planetLoads = new Map<number, Promise<HTMLImageElement>>();
const planetCacheOrder: number[] = [];

function touchPlanetCache(seed: number): void {
  const index = planetCacheOrder.indexOf(seed);
  if (index >= 0) planetCacheOrder.splice(index, 1);
  planetCacheOrder.push(seed);
}

function evictPlanetCache(): void {
  while (planetImages.size > MAX_PLANET_IMAGES && planetCacheOrder.length > 0) {
    const seed = planetCacheOrder.shift();
    if (seed === undefined) break;
    planetImages.delete(seed);
    planetLoads.delete(seed);
  }
}

export function loadPlanetImage(spec: PlanetSpec): Promise<HTMLImageElement> {
  const cached = planetImages.get(spec.seed);
  if (cached) {
    touchPlanetCache(spec.seed);
    return Promise.resolve(cached);
  }

  const pending = planetLoads.get(spec.seed);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = (): void => {
      planetImages.set(spec.seed, img);
      touchPlanetCache(spec.seed);
      evictPlanetCache();
      planetLoads.delete(spec.seed);
      resolve(img);
    };
    img.onerror = (): void => {
      planetLoads.delete(spec.seed);
      resolve(img);
    };
    img.src = svgToDataUrl(buildPlanetSvg(spec));
  });

  planetLoads.set(spec.seed, promise);
  return promise;
}

export function getPlanetImage(seed: number): HTMLImageElement | undefined {
  return planetImages.get(seed);
}

function pickSpawnPoint(
  width: number,
  height: number,
  size: number,
  others: BackgroundPlanet[],
  laneIndex: number,
  laneCount: number,
  edge?: "top" | "bottom" | "left" | "right",
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    let x = 0;
    let y = 0;

    if (edge) {
      const pad = size * 0.55 + 40;
      if (edge === "top") {
        x = width * (0.08 + Math.random() * 0.84);
        y = -pad - Math.random() * 120;
      } else if (edge === "bottom") {
        x = width * (0.08 + Math.random() * 0.84);
        y = height + pad + Math.random() * 120;
      } else if (edge === "left") {
        x = -pad - Math.random() * 120;
        y = height * (0.08 + Math.random() * 0.84);
      } else {
        x = width + pad + Math.random() * 120;
        y = height * (0.08 + Math.random() * 0.84);
      }
    } else {
      const laneX = (laneIndex + 0.5) / laneCount;
      x = width * clamp(0.1 + laneX * 0.8 + (Math.random() - 0.5) * 0.12, 0.06, 0.94);
      y = height * clamp(0.08 + ((laneIndex * 1.37 + Math.random() * 0.85) % 0.84), 0.05, 0.95);
    }

    if (isSpaced(x, y, size, others)) {
      return { x, y };
    }
  }

  return null;
}

export function createBackgroundField(width: number, height: number, count = 5): BackgroundPlanet[] {
  const planets: BackgroundPlanet[] = [];

  for (let i = 0; i < count; i += 1) {
    let placed: BackgroundPlanet | null = null;

    for (let attempt = 0; attempt < 32 && !placed; attempt += 1) {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      const spec = createPlanetSpec(seed);
      const depth = planetDepth(spec);
      const size = planetDrawSize(spec, depth);
      const point = pickSpawnPoint(width, height, size, planets, i, count);
      if (!point) continue;
      placed = { x: point.x, y: point.y, depth, spec };
    }

    if (placed) planets.push(placed);
  }

  return planets;
}

export type TravelHint = {
  vx: number;
  vy: number;
};

export function respawnBackgroundPlanet(
  existing: BackgroundPlanet[],
  self: BackgroundPlanet,
  width: number,
  height: number,
  travel: TravelHint,
): BackgroundPlanet {
  const others: BackgroundPlanet[] = [];
  for (const planet of existing) {
    if (planet !== self) others.push(planet);
  }
  let edge: "top" | "bottom" | "left" | "right" = "top";

  if (travel.vy < -40) edge = "bottom";
  else if (travel.vx > 40) edge = "left";
  else if (travel.vx < -40) edge = "right";

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const spec = createPlanetSpec(seed);
    const depth = planetDepth(spec);
    const size = planetDrawSize(spec, depth);
    const point = pickSpawnPoint(width, height, size, others, Math.floor(Math.random() * 5), 5, edge);
    if (!point) continue;
    return { x: point.x, y: point.y, depth, spec };
  }

  const fallback = createPlanetSpec((Math.random() * 0xffffffff) >>> 0);
  const depth = planetDepth(fallback);
  return {
    x: width * (0.15 + Math.random() * 0.7),
    y: -planetDrawSize(fallback, depth),
    depth,
    spec: fallback,
  };
}
