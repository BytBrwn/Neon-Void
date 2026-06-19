# Neon Void

**[Play now → mayphex.com](https://mayphex.com)**

A neon-soaked canvas arcade shooter built with React and TypeScript. Drift through a procedural starfield, survive escalating enemy waves, earn credits, and outfit your ship between rounds in the Void Shop.

![Neon Void social preview](./public/og-image.png)

## Gameplay

- **Wave survival** — Clear each wave of hostile drones, hunters, orbiters, splitters, and periodic bosses.
- **Combo scoring** — Chain kills to multiply your score.
- **Void Shop** — Spend credits between waves on blasters, hull support, and ship skins. Progress persists in `localStorage`.
- **Powerups** — Collect rapid fire, spread, pierce, damage boost, heal, and mega pickups dropped in combat.
- **AI Mode** — Watch a rule-based bot pilot the ship from the main menu.

### Blasters

| Blaster | Notes |
|---------|-------|
| **Pulse Bolt** | Starter weapon — focused single shots |
| **Needle Stream** | Fast narrow bolts |
| **Shard Burst** | Five-shot spread cone |
| **Pierce Lance** | Heavy bolt — punches through |
| **Twin Stream** | Dual parallel blasters |
| **Nova Cannon** | Slow heavy plasma orb |

### Ship skins

Interceptor (default), Needle, Bulwark, Phantom, and Comet — each with a distinct silhouette and preview in the shop.

## Controls

| Platform | Move | Aim / fire | Pause |
|----------|------|------------|-------|
| **Desktop** | `W` `A` `S` `D` | Mouse / `Space` | `Esc` / `P` |
| **Mobile** | Left thumb joystick | Right thumb aim & fire | `Esc` / `P` |

Touch controls use a dual-thumb layout with aim smoothing and reduced screen shake on phones.

## Tech stack

- **React 18** — HUD, shop overlay, health bar, input shell
- **Canvas 2D** — Game loop, rendering, particles, procedural planets
- **Vite 7** — Dev server and production build
- **TypeScript** — Strict typing across engine, systems, and factories

No game framework — the engine (`NeonEngine` / `GameSim`) owns simulation, collision, waves, and draw dispatch. React stays at the boundary for UI and device-specific input.

## Project layout

```
game/
├── index.html              # Standalone entry + meta / social tags
├── public/                 # Favicon, OG image (copied to dist root)
├── src/
│   ├── main.css            # HUD, overlays, mobile layout
│   ├── standalone/main.tsx # Boots NeonGame
│   └── game/
│       ├── NeonGame.tsx    # React shell, touch + desktop input
│       ├── HealthBar.tsx   # Hull integrity HUD
│       ├── core/           # NeonEngine, GameSim, renderer, pools
│       ├── systems/        # Waves, bullets, particles, shop, ambient
│       ├── factories/      # Enemies, blasters, planets
│       └── assets/         # Ship skin SVGs, powerup icons
└── vite.standalone.config.ts
```

See [`src/game/README.md`](./src/game/README.md) for a module map aimed at contributors and agents.

## Local development

**Requirements:** Node.js 22+ (matches CI)

```sh
cd game
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```sh
npm run build    # Output: game/dist
npm run preview  # Serve production build locally
npm run game:console   # Optional debug log terminal (see src/game/README.md)
```

## Deploy

Pushes to `master` trigger [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which builds `game/` and publishes `game/dist` to GitHub Pages at **mayphex.com**.

## License

Part of the [CATALYX Widgets](../) monorepo. The same game source is embedded in `foundry-widget/` for Palantir Foundry OSDK deployments.
