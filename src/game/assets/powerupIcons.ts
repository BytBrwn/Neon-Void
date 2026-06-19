import type { PowerupKind } from "../types.js";

const SIZE = 48;

type IconSpec = {
  hue: number;
  accent: string;
  stroke: string;
  fill: string;
  inner: string;
  markup: string;
};

const ICONS: Record<PowerupKind, IconSpec> = {
  rapid: {
    hue: 55,
    accent: "#ffe066",
    stroke: "#ffd24d",
    fill: "rgba(255, 210, 80, 0.14)",
    inner: "#fff6cc",
    markup: `
      <path d="M24 10 L30 22 L24 19 L18 22 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 19 L30 31 L24 28 L18 31 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M14 34 H34" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
    `,
  },
  spread: {
    hue: 130,
    accent: "#66ffaa",
    stroke: "#45ffb8",
    fill: "rgba(70, 255, 180, 0.12)",
    inner: "#d6ffe8",
    markup: `
      <circle cx="24" cy="26" r="3.2" fill="currentColor" opacity="0.9"/>
      <path d="M24 26 L24 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M24 26 L12 32" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M24 26 L36 32" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M24 26 L16 38" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>
      <path d="M24 26 L32 38" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>
    `,
  },
  pierce: {
    hue: 200,
    accent: "#66e5ff",
    stroke: "#33ddff",
    fill: "rgba(50, 220, 255, 0.12)",
    inner: "#ccfaff",
    markup: `
      <circle cx="17" cy="24" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.55"/>
      <circle cx="31" cy="24" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.55"/>
      <path d="M8 24 H40" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M34 24 L28 20 M34 24 L28 28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  damage: {
    hue: 350,
    accent: "#ff66b8",
    stroke: "#ff4da6",
    fill: "rgba(255, 80, 180, 0.14)",
    inner: "#ffd6ec",
    markup: `
      <path d="M24 9 L27.5 18.5 L37 18.5 L29.5 24.5 L32.5 34 L24 28.5 L15.5 34 L18.5 24.5 L11 18.5 L20.5 18.5 Z"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.85"/>
    `,
  },
  heal: {
    hue: 120,
    accent: "#77ff88",
    stroke: "#55ff77",
    fill: "rgba(85, 255, 120, 0.12)",
    inner: "#ddffe4",
    markup: `
      <rect x="20" y="13" width="8" height="22" rx="2" fill="currentColor"/>
      <rect x="13" y="20" width="22" height="8" rx="2" fill="currentColor"/>
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
    `,
  },
  mega: {
    hue: 280,
    accent: "#cc88ff",
    stroke: "#b366ff",
    fill: "rgba(180, 100, 255, 0.14)",
    inner: "#f0ddff",
    markup: `
      <polygon points="24,8 30,18 42,20 33,28 35,40 24,34 13,40 15,28 6,20 18,18"
        fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <polygon points="24,16 27,22 33,23 28,27 29,33 24,30 19,33 20,27 15,23 21,22"
        fill="currentColor" opacity="0.85"/>
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
    `,
  },
};

function buildSvg(kind: PowerupKind): string {
  const icon = ICONS[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <radialGradient id="bg" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="${icon.fill}"/>
        <stop offset="100%" stop-color="rgba(3,0,20,0.55)"/>
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="21" fill="url(#bg)" stroke="${icon.stroke}" stroke-width="1.6" opacity="0.95"/>
    <circle cx="24" cy="24" r="21" fill="none" stroke="${icon.accent}" stroke-width="0.8" opacity="0.35"/>
    <g filter="url(#glow)" color="${icon.inner}" stroke="${icon.stroke}">
      ${icon.markup}
    </g>
  </svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const iconImages: Partial<Record<PowerupKind, HTMLImageElement>> = {};
let iconsReady = false;

export function powerupIconHue(kind: PowerupKind): number {
  return ICONS[kind].hue;
}

export function loadPowerupIcons(): Promise<void> {
  if (iconsReady) return Promise.resolve();

  const kinds = Object.keys(ICONS) as PowerupKind[];
  return Promise.all(
    kinds.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = (): void => {
            iconImages[kind] = img;
            resolve();
          };
          img.onerror = (): void => resolve();
          img.src = svgToDataUrl(buildSvg(kind));
        }),
    ),
  ).then(() => {
    iconsReady = true;
  });
}

export function getPowerupIcon(kind: PowerupKind): HTMLImageElement | undefined {
  return iconImages[kind];
}

export function powerupIconsReady(): boolean {
  return iconsReady;
}
