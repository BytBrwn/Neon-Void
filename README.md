<p align="center">
  <img src="./game/public/apple-touch-icon.png" width="120" alt="Neon Void icon" />
</p>

<h1 align="center">CATALYX WIDGETS</h1>
<h3 align="center">Neon Void — arcade game, ML testbed, Foundry experiment</h3>

<p align="center">
  <strong>Drift. Survive. Upgrade. Break the combo ceiling.</strong><br />
  <a href="https://mayphex.com"><strong>▶ Play now at mayphex.com</strong></a>
</p>

<p align="center">
  <img src="./game/public/og-image.png" alt="Neon Void — survive the waves, upgrade your blaster" width="100%" />
</p>

---

**CATALYX Widgets** is a monorepo for **Neon Void** — a neon-soaked canvas arcade shooter — shipped in two forms: a **public browser game** and a **Palantir Foundry OSDK widget** for enterprise experimentation. One game core, multiple surfaces, one long-term vision: train agents on the sim, play it everywhere, and eventually **persist player and model state in a Foundry ontology**.

---

## What lives here

| Package | What it is |
|---------|------------|
| **[`game/`](./game/)** | Standalone Neon Void. Public npm deps only. Deployed to **[mayphex.com](https://mayphex.com)** via GitHub Pages. |
| **[`foundry-widget/`](./foundry-widget/)** | The **Foundry port** — same game embedded as a Palantir OSDK custom widget for experimenting inside Foundry workspaces. |

`foundry-widget/src/game` symlinks to `game/src/game`. Fix gameplay once; both surfaces get it.

```
game/src/game/          ← single source of truth (engine, sim, ML interface)
       ↑
       └── foundry-widget/src/game   (symlink)
```

Full game docs, controls, and ML details: **[`game/README.md`](./game/README.md)**

---

## The game

You are alone in the void — a single ship against an endless neon tide. Enemies spiral in from every angle. Your hull cracks. Your combo climbs. Credits pile up. Between waves, the **Void Shop** opens and you decide what kind of pilot you become next.

### The loop

```
LAUNCH → FIGHT THE WAVE → EARN CREDITS → VOID SHOP → NEXT WAVE → …
                ↑                                              |
                └──────────── boss waves · bigger stakes ──────┘
```

- **Wave survival** — Drifters, Hunters, Orbiters, Splitters, Bosses, and more
- **Combo scoring** — chain kills, push the multiplier
- **Void Shop** — blasters, hull support, ship skins between waves
- **Powerups** — rapid, spread, pierce, damage, heal, mega
- **AI Mode** — rule-based bot today; trained models tomorrow

---

## Two surfaces, one core

### `game/` — the public build

The standalone package is what ships to the internet. React shell + Canvas 2D engine. Mobile touch controls. No Foundry dependencies. This is the player-facing product and the **ML training environment**.

```sh
cd game
npm install
npm run dev        # http://localhost:3000
npm run build      # → game/dist
```

### `foundry-widget/` — the Foundry port

The Foundry widget is the **enterprise experiment surface** — Neon Void running inside **Palantir Foundry** via the **OSDK** (`@osdk/client`, `@osdk/widget.client-react`). Use it to:

- Embed the game in Foundry dashboards and workspaces
- Prototype how gameplay data connects to the rest of a Foundry stack
- Test widget UX, auth, and deployment in a real Foundry environment before wider rollout

```sh
cd foundry-widget
npm install
npm run dev
npm run dev:remote   # code-workspaces mode
npm run build
```

The widget does not fork the game. It wraps the same `game/src/game` module the public build uses.

---

## ML roadmap

Neon Void is not just a game — it is a **reinforcement-learning testbed**.

- **Headless `GameSim`** for fast rollouts without rendering
- **`observe(sim)`** — fixed-size observation vector (player, enemies, bullets, powerups)
- **`agentActionToInput()`** — 18 discrete actions for training loops
- **`RuleBot`** — heuristic baseline in **AI Mode** right now

**Coming next:** a full training suite, model shootouts in AI Mode, evaluation harnesses, and leaderboards per policy. The browser build is the arena; the sim is the gym.

See [`game/README.md`](./game/README.md) for the training-loop sketch and architecture notes.

---

## Foundry ontology vision

Today, save data lives in **`localStorage`** through the `IPersistence` abstraction — high scores, owned blasters, equipped skins, and loadouts. That is the right default for a public web game.

The **Foundry port** is where that data gets interesting.

**The goal:** **ontologize** game state in Palantir — model runs, saves, and agent performance as first-class Foundry objects so you can query, join, and operationalize them alongside the rest of your data:

| Concept | Ontology direction |
|---------|-------------------|
| **Player profiles** | Pilot identity, aggregate stats, unlock history |
| **Save states** | Wave reached, credits, loadout, hull — snapshot objects per run |
| **Run telemetry** | Score, combo peaks, deaths, shop purchases per session |
| **Agent runs** | Model ID, seed, waves cleared, reward curves — compare policies in Foundry |
| **Leaderboards** | Human vs bot performance linked to ontology records |

`IPersistence` was designed as a swap layer — `LocalStoragePersistence` for the web, `MemoryPersistence` for training, and eventually a **Foundry-backed persistence** implementation that reads and writes ontology objects instead of browser storage.

The widget is the sandbox. The ontology is the spine.

---

## Road to iOS

The long game for the **public `game/` build** is a native **iOS release** — same sim, tuned touch controls, App Store distribution, optional on-device agents. The Foundry widget and the mobile app serve different surfaces; they share the same core.

---

## Deploy

Pushes to `master` run [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which builds `game/` and publishes to GitHub Pages at **mayphex.com**.

The Foundry widget is built and deployed through Foundry's OSDK / CI pipeline (`foundry-widget/ci.yml`).

---

## Repo map

```
CATALYX-Widgets-repository/
├── game/                    # Standalone Neon Void → mayphex.com
│   ├── src/game/            # ★ shared game core
│   ├── public/              # Favicon, OG image, icons
│   └── README.md            # Deep dive: gameplay, ML, iOS
├── foundry-widget/          # Palantir OSDK widget (symlinks game core)
├── .github/workflows/       # GitHub Pages deploy
└── README.md                # You are here
```

Contributor module map: [`game/src/game/README.md`](./game/src/game/README.md)

---

<p align="center">
  <strong>Play it publicly. Experiment in Foundry. Train the agents. Ontologize the saves. Ship it to iOS.</strong>
</p>

<p align="center">
  <sub>CATALYX Widgets · Neon Void</sub>
</p>
