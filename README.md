<p align="center">
  <img src="./game/public/apple-touch-icon.png" width="120" alt="Neon Void icon" />
</p>

<h1 align="center">NEON VOID</h1>

<p align="center">
  <strong>A neon arcade space shooter — built to be fun first.</strong><br />
  <a href="https://mayphex.com"><strong>▶ Play now at mayphex.com</strong></a>
</p>

<p align="center">
  <img src="./game/public/og-image.png" alt="Neon Void — survive the waves, upgrade your blaster" width="100%" />
</p>

---

## Project summary

| | |
|---|---|
| **Name** | Neon Void |
| **Type** | Browser arcade space shooter (Canvas 2D + React) |
| **Live URL** | [mayphex.com](https://mayphex.com) |
| **Repo** | [github.com/BytBrwn/Neon-Void](https://github.com/BytBrwn/Neon-Void) |
| **Primary goal** | Make a fun game people want to play |
| **Secondary goals** | ML agent training testbed · Palantir Foundry port (side experiment) · future iOS release |
| **Tech** | TypeScript, React 18, Canvas 2D, Vite 7 |
| **Not** | A Foundry widget scaffold with a placeholder UI — the game in `game/` is the product |

> **What this repo is:** A browser arcade game — drift, shoot, survive waves, upgrade blasters in the Void Shop.<br />
> **What it is also:** An ML playground for training agents against the same sim.<br />
> **What it is not:** A Foundry widget project that happens to have a game. The game is the point.

**Neon Void** is a canvas arcade shooter. You fight escalating enemy waves, chain combos, spend credits between rounds, and unlock blasters and ship skins. It runs in the browser at **[mayphex.com](https://mayphex.com)** with desktop and mobile controls.

This monorepo also contains a **Palantir Foundry OSDK port** (`foundry-widget/`) — a side experiment to embed the same game in Foundry and eventually ontologize save states. That port is secondary. The fun game comes first.

---

## Why this exists

Three goals, in order:

1. **Make a fun game** — tight combat loop, juicy particles, shop meta-progression, mobile-friendly controls
2. **Train agents on it** — headless simulation, observation/action APIs, AI Mode for watching bots (and future model shootouts)
3. **Port it into Foundry on the side** — OSDK widget wrapper; long-term idea to ontologize saves, runs, and agent performance in Palantir

If you cloned this expecting a `@osdk/create-widget` template — look at **`game/`**. That's the actual product. Root-level Foundry files (`foundry.config.json`, `templateConfig.json`) are leftover scaffolding.

---

## Gameplay

You are alone in the void — a single ship against an endless neon tide. Enemies spiral in from every angle. Your hull cracks. Your combo climbs. Credits pile up. Between waves, the **Void Shop** opens and you decide what kind of pilot you become next.

### The loop

```
LAUNCH → FIGHT THE WAVE → EARN CREDITS → VOID SHOP → NEXT WAVE → …
                ↑                                              |
                └──────────── boss waves · bigger stakes ──────┘
```

**1. Launch into the void** — Procedural starfield, drifting planets, shooting stars, particle chaos. You start with **Pulse Bolt** and 100 hull integrity. Movement is momentum-based: you drift, you don't stop on a dime.

**2. Clear the wave** — Enemies escalate from **Drifters** to **Hunters**, **Orbiters**, **Splitters**, and **Bosses**. Chain kills for **combo multipliers**. Grab powerups: rapid fire, spread, pierce, damage boost, heal, mega.

**3. Void Shop** — Spend **CR** between waves:

| Tab | What you buy |
|-----|----------------|
| **Blasters** | Pulse Bolt → Needle Stream → Shard Burst → Pierce Lance → Twin Stream → Nova Cannon |
| **Support** | Hull repair, reinforced hull (+max HP) |
| **Skins** | Interceptor, Needle, Bulwark, Phantom, Comet |

Loadout persists in `localStorage`. Each run is a build path, not a reset.

**4. Push deeper** — Waves scale. Enemies get meaner. Blaster choice and positioning decide how far you get.

### Controls

| | Desktop | Mobile |
|---|---------|--------|
| **Move** | `W` `A` `S` `D` | Left thumb joystick |
| **Aim & fire** | Mouse / `Space` | Right thumb aim & fire |
| **Pause** | `Esc` / `P` | `Esc` / `P` |

Touch controls: aim smoothing, dual-thumb layout, reduced screen shake on phones.

---

## AI Mode & ML roadmap

**AI Mode** is on the main menu today — a **rule-based bot** (`RuleBot`) pilots your ship: dodges hostile fire, strafes enemies, recenters at screen edges, auto-respawns after death.

The sim is built as an **ML training environment**:

| Capability | Detail |
|------------|--------|
| Headless sim | `GameSim({ headless: true })` — fast rollouts, no rendering |
| Observations | `observe(sim)` → normalized `Float32Array` (player, enemies, bullets, powerups) |
| Actions | 18 discrete actions (9 move directions × fire on/off) via `agentActionToInput()` |
| Reproducibility | `Prng` seeded runs for fair model comparison |
| Performance | Zero-GC hot path, reusable buffers for 60+ steps/sec |

```ts
const sim = new GameSim({ headless: true });
sim.resize(800, 600);
sim.start();

while (sim.phase === "playing") {
  const obs = observe(sim);
  const action = agent.act(obs);
  sim.update(1 / 60, agentActionToInput(action, sim));
}
```

**Coming next:** training suite (rollout collectors, reward shaping, checkpoints), model shootouts in AI Mode, leaderboards per policy, human vs agent benchmarks.

The game is the gym. AI Mode is the arena. The shop meta-layer means agents must survive *and* economize.

---

## Foundry port (side experiment)

**`foundry-widget/`** wraps the same game for **Palantir Foundry** via the OSDK. It symlinks `game/src/game` — one codebase, two surfaces.

```
game/src/game/     ← game core (engine, sim, rendering, ML interface)
       ↑
       └── foundry-widget/src/game   (symlink — Foundry shell only)
```

**Goal:** ontologize game data in Foundry — save states, run telemetry, agent runs — as first-class objects instead of browser `localStorage`. `IPersistence` is the swap layer (`LocalStoragePersistence` today → Foundry-backed later).

```sh
cd foundry-widget
npm install
npm run dev          # local widget dev
npm run dev:remote   # Foundry code-workspaces
npm run build
```

---

## Road to iOS

Long-term: native **iOS** release — same sim, tuned touch controls, App Store, optional on-device agents. Mobile browser controls are already in production.

---

## Tech stack

| Layer | Tech |
|-------|------|
| UI shell | React 18, TypeScript |
| Game engine | Canvas 2D — `GameSim`, `GameRenderer`, pooled entities |
| Build | Vite 7 |
| Persistence | `localStorage` (scores, blasters, skins) via `IPersistence` |
| Agents | `RuleBot` (now) → trained models (next) |

No Unity. No Phaser. Clean boundary between **play** and **train**.

---

## Run locally

**Node.js 22+** (matches CI). No Foundry account needed.

```sh
cd game
npm install
npm run dev        # http://localhost:3000
npm run build      # → game/dist (ships to mayphex.com)
npm run preview    # serve production build
npm run game:console   # optional debug log terminal
```

---

## Repo layout

```
Neon-Void/
├── game/                 ★ THE GAME — play, build, deploy to mayphex.com
│   ├── src/game/         shared game core (engine, sim, systems, ML)
│   ├── public/           favicon, OG image, icons
│   └── index.html        standalone entry + social meta tags
├── foundry-widget/       Foundry OSDK wrapper (symlinks game core)
├── .github/workflows/    GitHub Pages deploy for game/
└── README.md             you are here (single source of truth)
```

Contributor module map: [`game/src/game/README.md`](./game/src/game/README.md)

---

## Deploy

| Surface | How |
|---------|-----|
| **Public game** | Push to `master` → [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) → GitHub Pages → **mayphex.com** |
| **Foundry widget** | Foundry CI / OSDK pipeline (`foundry-widget/ci.yml`) |

---

<p align="center">
  <strong>Fun game first. ML playground second. Foundry port on the side.</strong>
</p>

<p align="center">
  <sub>Neon Void · CATALYX Widgets monorepo · Play at mayphex.com</sub>
</p>
