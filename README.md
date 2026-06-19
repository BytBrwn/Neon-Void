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

> **What this repo is:** A browser arcade game — drift, shoot, survive waves, upgrade blasters in the Void Shop.<br />
> **What it is also:** An ML playground for training agents against the same sim.<br />
> **What it is not:** A Foundry widget project that happens to have a game. The game is the point.

**Neon Void** is a canvas arcade shooter built with React and TypeScript. You fight escalating enemy waves, chain combos, spend credits between rounds, and unlock blasters and ship skins. It runs in the browser today at **[mayphex.com](https://mayphex.com)** with desktop and mobile controls.

The repo happens to live in a monorepo that *also* contains a **Palantir Foundry port** — a side experiment to embed the same game inside Foundry and eventually persist save states in an ontology. That port is secondary. The fun game comes first.

---

## Why this exists

Three goals, in order:

1. **Make a fun game** — tight combat loop, juicy particles, shop meta-progression, mobile-friendly controls
2. **Train agents on it** — headless simulation, observation/action APIs, AI Mode for watching bots (and future model shootouts)
3. **Port it into Foundry on the side** — OSDK widget wrapper around the same game core; long-term idea to ontologize saves, runs, and agent performance in Palantir

If you cloned this expecting a `@osdk/create-widget` scaffold with a placeholder UI — look at **`game/`**. That's the actual product.

---

## The loop

```
LAUNCH → FIGHT THE WAVE → EARN CREDITS → VOID SHOP → NEXT WAVE → …
                ↑                                              |
                └──────────── boss waves · bigger stakes ──────┘
```

You start with the **Pulse Bolt** blaster and 100 hull integrity. Enemies escalate from **Drifters** to **Hunters**, **Orbiters**, **Splitters**, and **Bosses**. Chain kills for combo multipliers. Grab powerups mid-fight. Between waves, the **Void Shop** opens — blasters, hull repair, ship skins. Your loadout persists. Each run is a build path.

| | Desktop | Mobile |
|---|---------|--------|
| **Move** | `W` `A` `S` `D` | Left thumb joystick |
| **Aim & fire** | Mouse / `Space` | Right thumb aim & fire |
| **Pause** | `Esc` / `P` | `Esc` / `P` |

**AI Mode** on the main menu launches a rule-based bot today. The plan is to swap in trained models and compare them in the same arena.

Full gameplay docs: **[`game/README.md`](./game/README.md)**

---

## Play it locally

The game lives in **`game/`**. No Foundry account required.

```sh
cd game
npm install
npm run dev        # http://localhost:3000
npm run build      # → game/dist (what ships to mayphex.com)
```

**Stack:** React 18 · Canvas 2D · TypeScript · Vite 7 · `localStorage` for saves

**Engine:** `GameSim` + `GameRenderer` — pooled entities, procedural planets, particle VFX, wave/shop systems. No Unity, no Phaser.

---

## ML side project

The sim was built with training in mind:

- **Headless `GameSim`** — fast rollouts, no rendering
- **`observe(sim)`** — fixed observation vector (player, enemies, bullets, powerups)
- **`agentActionToInput()`** — 18 discrete actions for RL loops
- **`RuleBot`** — heuristic baseline in AI Mode now

**Coming next:** training suite, model comparison in AI Mode, evaluation harnesses, leaderboards per policy.

```ts
const sim = new GameSim({ headless: true });
sim.start();
while (sim.phase === "playing") {
  const obs = observe(sim);
  sim.update(1 / 60, agentActionToInput(agent.act(obs), sim));
}
```

The game is the gym. AI Mode is the spectator sport until the models are ready.

---

## Foundry port (side experiment)

The **`foundry-widget/`** package wraps the same game for **Palantir Foundry** via the OSDK. It symlinks `game/src/game` — one codebase, two surfaces.

```
game/src/game/     ← the game (engine, sim, rendering, ML interface)
       ↑
       └── foundry-widget/src/game   (symlink — Foundry shell only)
```

**Why bother?** To experiment with embedding Neon Void inside Foundry workspaces and, eventually, **ontologize** game data — save states, run telemetry, agent performance — as Foundry objects instead of browser `localStorage`.

| Future ontology concept | Example |
|-------------------------|---------|
| Save states | Wave, credits, loadout snapshots |
| Run telemetry | Score, deaths, shop purchases |
| Agent runs | Model ID, seed, waves cleared |

`IPersistence` is already a swap layer (`localStorage` today → Foundry-backed storage later). The Foundry widget is a sandbox for that vision, not the reason the game exists.

```sh
cd foundry-widget
npm install
npm run dev          # local widget dev
npm run dev:remote   # Foundry code-workspaces
```

---

## Road to iOS

Long-term goal for the public build: native **iOS** — same sim, tuned touch controls, App Store. Mobile browser controls are already in production as the foundation.

---

## Repo layout

```
Neon-Void/
├── game/                 ★ THE GAME — play, build, deploy to mayphex.com
│   ├── src/game/         shared game core (engine, sim, systems)
│   ├── public/           favicon, OG image, icons
│   └── README.md         deep dive
├── foundry-widget/       Foundry OSDK wrapper (symlinks game core)
├── .github/workflows/    GitHub Pages deploy for game/
└── README.md             you are here
```

Some root-level Foundry scaffolding files (`foundry.config.json`, `templateConfig.json`, etc.) remain from the original widget template. **`game/` is the source of truth.**

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
  <sub>Neon Void · CATALYX Widgets monorepo</sub>
</p>
