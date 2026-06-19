# Neon Void / CATALYX Widgets

Monorepo layout:

| Package | Purpose |
|---------|---------|
| **`game/`** | Standalone Neon Void game (public npm deps only). Deployed to [mayphex.com](https://mayphex.com) via GitHub Pages. |
| **`foundry-widget/`** | Palantir Foundry OSDK widget embedding the same game. |

## Standalone game (`game/`)

Full game documentation: **[game/README.md](./game/README.md)** (play link, controls, architecture, deploy).

```sh
cd game
npm install
npm run dev        # http://localhost:3000
npm run build      # output: game/dist
npm run game:console
```

## Foundry widget (`foundry-widget/`)

```sh
cd foundry-widget
npm install
npm run dev
npm run build
```

`foundry-widget/src/game` is a git symlink to `game/src/game`.

## Deploy

Pushes to `master` run `.github/workflows/deploy.yml`, which builds `game/` and publishes to the `gh-pages` branch.
