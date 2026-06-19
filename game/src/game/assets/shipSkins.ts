import type { ShipSkinId } from "../types.js";

const SIZE = 64;

export type ShipSkinSpec = {
  id: ShipSkinId;
  label: string;
  detail: string;
  cost: number;
  stroke: string;
  fill: string;
  glow: string;
  thrustHue: number;
  engineOffset: number;
  muzzleOffset: number;
  engineSpread: number;
  markup: string;
};

export const SHIP_SKINS: Record<ShipSkinId, ShipSkinSpec> = {
  interceptor: {
    id: "interceptor",
    label: "Interceptor",
    detail: "Balanced void fighter",
    cost: 0,
    stroke: "#00ffdc",
    fill: "rgba(0, 255, 220, 0.22)",
    glow: "#b8ffff",
    thrustHue: 185,
    engineOffset: 20,
    muzzleOffset: 28,
    engineSpread: 7,
    markup: `
      <path d="M14 32 L26 24 L26 40 Z" fill="url(#hull)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M14 32 L26 40 L26 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/>
      <path d="M26 28 L48 30 L48 34 L26 36 Z" fill="rgba(0,255,220,0.15)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="46" y="29" width="10" height="6" rx="1.5" fill="rgba(180,255,250,0.35)" stroke="currentColor" stroke-width="1.4"/>
      <circle cx="30" cy="32" r="2.2" fill="currentColor" opacity="0.55"/>
    `,
  },
  needle: {
    id: "needle",
    label: "Needle",
    detail: "Sleek piercing dart",
    cost: 45,
    stroke: "#ff66cc",
    fill: "rgba(255, 80, 200, 0.18)",
    glow: "#ffccee",
    thrustHue: 310,
    engineOffset: 22,
    muzzleOffset: 30,
    engineSpread: 5,
    markup: `
      <path d="M16 32 L28 27 L28 37 Z" fill="url(#hull)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M28 30 L50 31.5 L50 32.5 L28 34 Z" fill="rgba(255,80,200,0.12)" stroke="currentColor" stroke-width="1.6"/>
      <rect x="48" y="30.5" width="12" height="3" rx="1" fill="currentColor" opacity="0.45"/>
    `,
  },
  bulwark: {
    id: "bulwark",
    label: "Bulwark",
    detail: "Wide armored chassis",
    cost: 60,
    stroke: "#ffaa44",
    fill: "rgba(255, 160, 60, 0.2)",
    glow: "#ffe0aa",
    thrustHue: 35,
    engineOffset: 18,
    muzzleOffset: 26,
    engineSpread: 10,
    markup: `
      <path d="M12 32 L24 20 L24 44 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M24 26 L44 28 L44 36 L24 38 Z" fill="rgba(255,160,60,0.18)" stroke="currentColor" stroke-width="2"/>
      <rect x="42" y="28.5" width="11" height="7" rx="2" fill="rgba(255,200,120,0.35)" stroke="currentColor" stroke-width="1.5"/>
    `,
  },
  phantom: {
    id: "phantom",
    label: "Phantom",
    detail: "Stealth diamond hull",
    cost: 75,
    stroke: "#aa77ff",
    fill: "rgba(150, 90, 255, 0.18)",
    glow: "#ddccff",
    thrustHue: 265,
    engineOffset: 19,
    muzzleOffset: 27,
    engineSpread: 8,
    markup: `
      <path d="M16 32 L30 44 L30 20 Z" fill="url(#hull)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M30 28 L46 30 L46 34 L30 36 Z" fill="rgba(150,90,255,0.14)" stroke="currentColor" stroke-width="1.6"/>
      <rect x="44" y="29.5" width="9" height="5" rx="1.2" fill="currentColor" opacity="0.4"/>
    `,
  },
  comet: {
    id: "comet",
    label: "Comet",
    detail: "Dual-wing racer",
    cost: 90,
    stroke: "#44ffee",
    fill: "rgba(60, 255, 230, 0.16)",
    glow: "#ccfff8",
    thrustHue: 170,
    engineOffset: 21,
    muzzleOffset: 29,
    engineSpread: 9,
    markup: `
      <path d="M14 32 L26 22 L26 42 Z" fill="url(#hull)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M10 40 L18 36 M10 24 L18 28" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
      <path d="M26 29 L47 31 L47 33 L26 35 Z" fill="rgba(60,255,230,0.14)" stroke="currentColor" stroke-width="1.6"/>
      <rect x="45" y="30" width="10" height="4" rx="1" fill="currentColor" opacity="0.42"/>
    `,
  },
};

const SKIN_IDS = Object.keys(SHIP_SKINS) as ShipSkinId[];

function buildSvg(spec: ShipSkinSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <radialGradient id="hull" cx="40%" cy="50%" r="65%">
        <stop offset="0%" stop-color="${spec.fill}"/>
        <stop offset="100%" stop-color="rgba(3,0,20,0.15)"/>
      </radialGradient>
    </defs>
    <g filter="url(#glow)" color="${spec.glow}" stroke="${spec.stroke}">
      ${spec.markup}
    </g>
  </svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const iconImages: Partial<Record<ShipSkinId, HTMLImageElement>> = {};
const previewUrls: Partial<Record<ShipSkinId, string>> = {};
let iconsReady = false;

export function getShipSkinSpec(id: ShipSkinId): ShipSkinSpec {
  return SHIP_SKINS[id];
}

export function getShipSkinPreviewUrl(id: ShipSkinId): string {
  const cached = previewUrls[id];
  if (cached) return cached;
  const url = svgToDataUrl(buildSvg(SHIP_SKINS[id]));
  previewUrls[id] = url;
  return url;
}

export function loadShipSkins(): Promise<void> {
  if (iconsReady) return Promise.resolve();
  return Promise.all(
    SKIN_IDS.map(
      (id) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = (): void => {
            iconImages[id] = img;
            resolve();
          };
          img.onerror = (): void => resolve();
          img.src = svgToDataUrl(buildSvg(SHIP_SKINS[id]));
        }),
    ),
  ).then(() => {
    iconsReady = true;
  });
}

export function getShipSkinImage(id: ShipSkinId): HTMLImageElement | undefined {
  return iconImages[id];
}

export function allShipSkinIds(): ShipSkinId[] {
  return SKIN_IDS;
}
