# Neon Void — module map

Agent-oriented layout for the canvas arcade game under `src/game/`.

## Entry points

| Path | Role |
|------|------|
| `NeonGame.tsx` | React shell: canvas, HUD, shop overlay, input |
| `engine.ts` | Back-compat re-export of `NeonEngine` |
| `index.ts` | Public barrel exports |

## Core orchestrator

| Path | Role |
|------|------|
| `core/NeonEngine.ts` | Game loop: state, update, collisions, wave flow, render dispatch |

The engine **delegates** to systems and factories; it should not grow new domain logic inline.

## Factories (spawn / procedural assets)

| Path | Exports |
|------|---------|
| `factories/enemyFactory.ts` | `createEnemy`, `ENEMY_SCORE`, `ENEMY_CREDITS` |
| `factories/planetFactory.ts` | `createBackgroundField`, procedural SVG planets |

Root shims (`planetFactory.ts`, `shipSkins.ts`, `powerupIcons.ts`) re-export from `factories/` and `assets/`.

## Systems (pure tick / rules)

| Path | Responsibility |
|------|----------------|
| `systems/ambient.ts` | Stars, shooting stars, background planets (`AmbientField`) |
| `systems/bullets.ts` | `shoot`, gravity wells, `tickBullets` |
| `systems/particles.ts` | Burst, shockwave, `tickParticles` |
| `systems/powerups.ts` | Drop rolls, apply effects, `tickPowerups` |
| `systems/shop.ts` | Offer catalog, pricing, `applyShopItem` |
| `systems/waves.ts` | Boss/shop waves, spawn kind picker, clear bonus |

## Shared utilities

| Path | Contents |
|------|----------|
| `types.ts` | All game entity / phase types |
| `math.ts` | RNG, vectors, easing, `waveScale` |
| `constants.ts` | Tunables (gravity, star count, particle cap) |
| `persistence.ts` | High score + ship skin localStorage |
| `debug.ts` | `DEBUG_TOOLS_ENABLED` flag |
| `console/client.ts` | HTTP transport to terminal |
| `console/logger.ts` | Typed `GameLogger` — all debug events |

## Terminal console (dev)

Run in a separate command prompt while playing:

```bash
node "C:\Users\Jordab\Desktop\CATALYX\CATALYX-Widgets-repository\scripts\game-console.mjs"
```

```bash
npm run dev
```

### Log categories

| Category | Events |
|----------|--------|
| **combat** | `player_damage`, `enemy_damage`, `enemy_kill`, `combo_break`, `splitter_spawn` |
| **wave** | `wave_start`, `wave_clear`, `enemy_spawn`, `round_frozen` / `round_unfrozen` |
| **lifecycle** | `game_start`, `pause`, `resume`, `exit_to_menu`, `player_death` |
| **shop** | `shop_open`, `shop_close`, `shop_purchase`, `skin_purchase` |
| **powerup** | `powerup_drop`, `powerup_collect` |
| **sandbox** | `sandbox_enter`, `sandbox_exit`, `sandbox_reset`, `sandbox_invincible` |
| **stats** | `stats_tick` (every 5s), `memory` (Chrome heap) |

Combat example output:
```
PLAYER −22 (contact:boss) → 78/100 HP
HUNTER −28 → 4/18 HP
KILL HUNTER +84pts +6cr (combo x3)
```

Optional env: `VITE_GAME_CONSOLE_URL` · `GAME_CONSOLE_PORT=7720`

## Assets

| Path | Contents |
|------|----------|
| `assets/shipSkins.ts` | Ship SVG specs + image cache |
| `assets/powerupIcons.ts` | Powerup icon SVG cache |

## UI components

| Path | Role |
|------|------|
| `HealthBar.tsx` | Player health HUD |
| `DebugPanel.tsx` | Sandbox / debug controls (gated by `debug.ts`) |

## Typical change locations

- **New enemy type** → `types.ts` + `factories/enemyFactory.ts` + AI branch in `NeonEngine.updateEnemies`
- **Bullet behavior** → `systems/bullets.ts`
- **Visual background** → `systems/ambient.ts` or draw helpers in `NeonEngine.render`
- **Shop item** → `systems/shop.ts`
- **Wave pacing** → `systems/waves.ts` + `NeonEngine.updateWave`
