// The player: Wren, the night archivist. Walks with WASD or the arrow keys,
// sneaks while Shift is held, and throws a pebble with a mouse click to pull
// a guard away from a patrol route.

import {
  PEBBLE_FLY_SECONDS,
  PEBBLE_THROW_COOLDOWN,
  PLAYER_PEBBLES_START,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
  TILE,
} from './config.js';
import { slideMove } from './level.js';

const STEP_EVERY_PX = 26;

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.radius = 9;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.pebbles = PLAYER_PEBBLES_START;
    this.throwCooldownLeft = 0;
    /** A pebble in flight: { fromX, fromY, toX, toY, t } or null. */
    this.pebbleInFlight = null;
    /** Where the last pebble landed, with a fading ring timer. */
    this.pebbleLanded = null;
    this.stepAccumulator = 0;
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.pebbles = PLAYER_PEBBLES_START;
    this.throwCooldownLeft = 0;
    this.pebbleInFlight = null;
    this.pebbleLanded = null;
    this.stepAccumulator = 0;
  }

  /** Move from the held keys; returns true when a footstep falls due. */
  update(dt, keys) {
    this.throwCooldownLeft = Math.max(0, this.throwCooldownLeft - dt);
    if (this.pebbleLanded) {
      this.pebbleLanded.ringLeft -= dt;
      if (this.pebbleLanded.ringLeft <= 0) this.pebbleLanded = null;
    }
    if (this.pebbleInFlight) {
      this.pebbleInFlight.t += dt / PEBBLE_FLY_SECONDS;
      if (this.pebbleInFlight.t >= 1) {
        const pebble = this.pebbleInFlight;
        this.pebbleInFlight = null;
        this.pebbleLanded = { x: pebble.toX, y: pebble.toY, ringLeft: 0.9 };
        return { landed: { x: pebble.toX, y: pebble.toY } };
      }
    }

    let dx = 0;
    let dy = 0;
    if (keys.has('left')) dx -= 1;
    if (keys.has('right')) dx += 1;
    if (keys.has('up')) dy -= 1;
    if (keys.has('down')) dy += 1;
    this.sneaking = keys.has('sneak');
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return null;

    const length = Math.hypot(dx, dy);
    const speed = (this.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED) * TILE;
    const moved = slideMove(
      this.x,
      this.y,
      (dx / length) * speed * dt,
      (dy / length) * speed * dt,
      this.radius,
    );
    const actuallyMoved = Math.hypot(moved.x - this.x, moved.y - this.y);
    if (actuallyMoved > 0.5) this.facing = Math.atan2(moved.y - this.y, moved.x - this.x);
    this.x = moved.x;
    this.y = moved.y;
    this.stepAccumulator += actuallyMoved;
    if (this.stepAccumulator >= STEP_EVERY_PX) {
      this.stepAccumulator -= STEP_EVERY_PX;
      return { step: true };
    }
    return null;
  }

  /** Start a pebble arcing toward (x, y); false when out of pebbles. */
  throwPebble(x, y) {
    if (this.pebbles <= 0 || this.throwCooldownLeft > 0 || this.pebbleInFlight) return false;
    this.pebbles -= 1;
    this.throwCooldownLeft = PEBBLE_THROW_COOLDOWN;
    this.pebbleInFlight = { fromX: this.x, fromY: this.y, toX: x, toY: y, t: 0 };
    return true;
  }

  /** The pebble's position mid-flight, with a little hop for the arc. */
  pebblePosition() {
    if (!this.pebbleInFlight) return null;
    const p = this.pebbleInFlight;
    const hop = Math.sin(p.t * Math.PI) * 18;
    return {
      x: p.fromX + (p.toX - p.fromX) * p.t,
      y: p.fromY + (p.toY - p.fromY) * p.t - hop,
    };
  }
}
