/**
 * NeonEngine — thin facade composing GameSim + GameRenderer.
 *
 * This class exists solely so NeonGame.tsx (and the Foundry widget) can keep
 * the same API they already use: new NeonEngine(), engine.update(), engine.draw().
 * All game logic lives in GameSim. All rendering lives in GameRenderer.
 */

import { GameSim, type GameSimOptions } from "./GameSim.js";
import { GameRenderer } from "./GameRenderer.js";

export class NeonEngine extends GameSim {
  private readonly renderer: GameRenderer;

  constructor(options?: GameSimOptions) {
    super(options);
    this.renderer = new GameRenderer(this);
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
    this.renderer.onResize();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx);
  }
}
