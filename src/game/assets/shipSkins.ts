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
  /** Distance from ship center to rear nozzle along -X */
  engineOffset: number;
  /** Distance from ship center to muzzle along +X */
  muzzleOffset: number;
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
    engineOffset: 14,
    muzzleOffset: 22,
    markup: `
      <path d="M52 32 L18 46 L26 32 L18 18 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M24 32 L14 38 M24 32 L14 26" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
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
    engineOffset: 16,
    muzzleOffset: 24,
    markup: `
      <path d="M54 32 L22 36 L28 32 L22 28 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30 32 H16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
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
    engineOffset: 12,
    muzzleOffset: 20,
    markup: `
      <path d="M48 32 L16 44 L22 32 L16 20 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="12" y="27" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.45"/>
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
    engineOffset: 13,
    muzzleOffset: 21,
    markup: `
      <path d="M50 32 L32 44 L14 32 L32 20 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.35"/>
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
    engineOffset: 15,
    muzzleOffset: 23,
    markup: `
      <path d="M50 32 L24 40 L30 32 L24 24 Z" fill="url(#hull)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 40 L10 46 M20 24 L10 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
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
let iconsReady = false;

export function getShipSkinSpec(id: ShipSkinId): ShipSkinSpec {
  return SHIP_SKINS[id];
}

export function getShipSkinPreviewUrl(id: ShipSkinId): string {
  return svgToDataUrl(buildSvg(SHIP_SKINS[id]));
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
