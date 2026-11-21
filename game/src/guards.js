// The museum's guards: their patrol routes, their state machine, and how
// they react to what they see and hear. A guard is patrol, suspicious,
// chasing, searching or returning; suspicion itself lives in main.js, fed by
// every guard that can see the player.

import {
  GUARD_CHASE_SPEED,
  GUARD_LOSE_SIGHT_SECONDS,
  GUARD_PATROL_SPEED,
  GUARD_SEARCH_SECONDS,
  GUARD_SEARCH_SPEED,
  GUARD_WAYPOINT_PAUSE,
  SUSPICION_ALERT_AT,
  SUSPICION_WARY_AT,
  TILE,
} from './config.js';
import { slideMove, tileCentre } from './level.js';

/**
 * The four guards on duty, with their patrol routes in tile coordinates.
 * Every leg of a route runs in a straight line over open floor: no leg
 * crosses a wall, a shelf or a crate, or a guard would walk into it and
 * stop, so the routes were checked against the map tile by tile.
 */
export const GUARD_ROSTER = [
  { name: 'Marlow', waypoints: [[9, 1], [13, 1], [13, 5], [9, 5]] },
  { name: 'Brant', waypoints: [[3, 8], [20, 8]] },
  { name: 'Okafor', waypoints: [[18, 1], [21, 1], [21, 4], [18, 4]] },
  {
    name: 'Ivers',
    waypoints: [
      [9, 9], [13, 9], [13, 11], [10, 11], [10, 13],
      [13, 13], [9, 13], [10, 13], [10, 11], [9, 11],
    ],
  },
];

const STEP_EVERY_PX = 30;

export class Guard {
  constructor(rosterEntry) {
    this.name = rosterEntry.name;
    this.waypoints = rosterEntry.waypoints.map(([tx, ty]) => tileCentre(tx, ty));
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = 'patrol';
    this.waypointIndex = 1;
    this.pauseLeft = 0;
    this.scanPhase = 0;
    this.lastSeen = { x: this.x, y: this.y };
    this.loseSightLeft = 0;
    this.searchLeft = 0;
    this.investigateTarget = null;
    this.stepAccumulator = 0;
    this.stuckFor = 0;
    this.chasing = false;
  }

  /** Where the guard is walking toward right now, or null while standing. */
  currentTarget() {
    if (this.state === 'patrol') return this.waypoints[this.waypointIndex];
    if (this.state === 'chase') return this.lastSeen;
    if (this.state === 'investigate' && this.investigateTarget) return this.investigateTarget;
    if (this.state === 'return') return this.waypoints[this.waypointIndex];
    return null;
  }

  speedForState() {
    if (this.state === 'chase') return GUARD_CHASE_SPEED;
    if (this.state === 'investigate' || this.state === 'return') return GUARD_SEARCH_SPEED;
    return GUARD_PATROL_SPEED;
  }

  /** Walk toward a point at the state's speed; returns true on arrival. */
  walkToward(target, dt, onStep) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) return true;
    const speed = this.speedForState() * TILE;
    const step = Math.min(distance, speed * dt);
    const moved = slideMove(this.x, this.y, (dx / distance) * step, (dy / distance) * step, 9);
    const actuallyMoved = Math.hypot(moved.x - this.x, moved.y - this.y);
    if (actuallyMoved < step * 0.25) {
      this.stuckFor += dt;
    } else {
      this.stuckFor = 0;
    }
    this.x = moved.x;
    this.y = moved.y;
    this.facing = Math.atan2(dy, dx);
    this.stepAccumulator += actuallyMoved;
    if (this.stepAccumulator >= STEP_EVERY_PX) {
      this.stepAccumulator -= STEP_EVERY_PX;
      onStep(this);
    }
    return distance <= step + 1;
  }

  /** Turn to face a point at up to `turnRate` radians per second. */
  turnToward(tx, ty, dt, turnRate = 6) {
    const wanted = Math.atan2(ty - this.y, tx - this.x);
    let diff = wanted - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    this.facing += turn;
  }

  /** A noise at (x, y) pulls the guard over to look, unless already chasing. */
  hearNoise(x, y) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.investigateTarget = { x, y };
    this.pauseLeft = 0;
  }

  /**
   * One tick of guard behaviour. `view` carries what this guard can see and
   * the shared suspicion level; `events` collects what happened this tick
   * (an alert starting, the player being caught) for main.js to act on.
   */
  update(dt, view, events) {
    const { playerX, playerY, canSee, suspicion } = view;
    if (canSee) {
      this.lastSeen = { x: playerX, y: playerY };
      this.loseSightLeft = GUARD_LOSE_SIGHT_SECONDS;
    }

    if (this.state === 'chase') {
      if (Math.hypot(playerX - this.x, playerY - this.y) < 26) {
        events.push({ type: 'caught', guard: this });
        return;
      }
      if (!canSee) {
        this.loseSightLeft -= dt;
        if (this.loseSightLeft <= 0 || this.stuckFor > 0.9) {
          this.state = 'search';
          this.searchLeft = GUARD_SEARCH_SECONDS;
          this.stuckFor = 0;
          return;
        }
      }
      this.walkToward({ x: playerX, y: playerY }, dt, view.onStep);
      return;
    }

    if (canSee && suspicion >= SUSPICION_ALERT_AT) {
      this.state = 'chase';
      this.chasing = true;
      this.loseSightLeft = GUARD_LOSE_SIGHT_SECONDS;
      events.push({ type: 'alert', guard: this });
      return;
    }

    if (this.state === 'suspicious') {
      this.turnToward(playerX, playerY, dt);
      if (!canSee || suspicion < SUSPICION_WARY_AT - 12) {
        this.state = 'patrol';
      }
      return;
    }

    if (canSee && suspicion >= SUSPICION_WARY_AT) {
      this.state = 'suspicious';
      this.turnToward(playerX, playerY, dt);
      return;
    }

    if (this.state === 'investigate') {
      const arrived = this.walkToward(this.investigateTarget, dt, view.onStep);
      if (arrived) {
        this.pauseLeft += dt;
        this.scanPhase += dt;
        this.facing += Math.sin(this.scanPhase * 2.2) * 1.4 * dt;
        if (this.pauseLeft > 2.2) {
          this.state = 'return';
          this.investigateTarget = null;
        }
      }
      return;
    }

    if (this.state === 'search') {
      this.searchLeft -= dt;
      this.scanPhase += dt;
      this.facing += Math.sin(this.scanPhase * 2.6) * 1.6 * dt;
      if (this.searchLeft <= 0) this.state = 'return';
      return;
    }

    if (this.state === 'return') {
      let nearest = 0;
      let nearestDistance = Infinity;
      this.waypoints.forEach((point, index) => {
        const d = Math.hypot(point.x - this.x, point.y - this.y);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = index;
        }
      });
      this.waypointIndex = nearest;
      if (this.walkToward(this.waypoints[this.waypointIndex], dt, view.onStep)) {
        this.state = 'patrol';
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      }
      return;
    }

    // Patrol: walk the route, pausing at each waypoint to look around.
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt;
      this.scanPhase += dt;
      this.facing += Math.sin(this.scanPhase * 1.8) * 1.1 * dt;
      if (this.pauseLeft <= 0) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      }
      return;
    }
    if (this.walkToward(this.waypoints[this.waypointIndex], dt, view.onStep)) {
      this.pauseLeft = GUARD_WAYPOINT_PAUSE;
      this.scanPhase = 0;
    } else if (this.stuckFor > 1.2) {
      // A route should never wedge a guard, but if one ever does, skip to
      // the next waypoint rather than standing against a wall all shift.
      this.stuckFor = 0;
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
    }
  }
}
