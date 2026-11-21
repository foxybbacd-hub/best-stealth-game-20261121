// Guard senses: line of sight across the tile grid, the vision cone test,
// and how fast suspicion climbs once the player is seen. Pure functions,
// so the game and the screenshot staging can share them exactly.

import {
  GUARD_HALF_ANGLE,
  GUARD_SIGHT_RANGE,
  SUSPICION_SEEN_CLOSE_PER_SECOND,
  SUSPICION_SEEN_FAR_PER_SECOND,
  SUSPICION_SHADOW_FACTOR,
  SUSPICION_SNEAK_FACTOR,
  TILE,
} from './config.js';
import { blocksSight, isShadow } from './level.js';

function tileOf(px, py) {
  return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
}

/**
 * True when no sight-blocking tile stands between two points. Samples the
 * line in small steps; a crate counts as blocking only while the player is
 * sneaking low behind it, which is how crouching behind cover hides you.
 */
export function hasLineOfSight(fromX, fromY, toX, toY, sneaking) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const { tx, ty } = tileOf(fromX + dx * t, fromY + dy * t);
    if (blocksSight(tx, ty, sneaking)) return false;
  }
  return true;
}

/**
 * True when the player stands inside the guard's vision cone, in range, and
 * with a clear line of sight. The cone is checked first because it is the
 * cheapest test; line of sight is only traced for a player inside the cone.
 */
export function guardCanSee(guard, playerX, playerY, sneaking) {
  const dx = playerX - guard.x;
  const dy = playerY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD_SIGHT_RANGE) return false;
  const angleToPlayer = Math.atan2(dy, dx);
  let angleDifference = angleToPlayer - guard.facing;
  while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
  while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
  if (Math.abs(angleDifference) > GUARD_HALF_ANGLE) return false;
  return hasLineOfSight(guard.x, guard.y, playerX, playerY, sneaking);
}

/**
 * Suspicion gained per second while one guard can see the player. Close is
 * dangerous, far is slow; sneaking and standing in shadow each slow it
 * further, so patience and darkness are both real routes through a patrol.
 */
export function suspicionPerSecond(guard, playerX, playerY, sneaking) {
  const distance = Math.hypot(playerX - guard.x, playerY - guard.y);
  const closeness = 1 - distance / GUARD_SIGHT_RANGE;
  let rate =
    SUSPICION_SEEN_FAR_PER_SECOND +
    (SUSPICION_SEEN_CLOSE_PER_SECOND - SUSPICION_SEEN_FAR_PER_SECOND) * closeness;
  if (sneaking) rate *= SUSPICION_SNEAK_FACTOR;
  const { tx, ty } = tileOf(playerX, playerY);
  if (isShadow(tx, ty)) rate *= SUSPICION_SHADOW_FACTOR;
  return rate;
}

/**
 * The points of a guard's vision cone as a fan of rays, each ray marching
 * forward until a sight-blocking tile stops it. The renderer fills this
 * polygon, so the cone on screen is exactly what the guard can see.
 */
export function visionConePolygon(guard, sneaking, rayCount = 26) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rayCount; i += 1) {
    const angle = guard.facing - GUARD_HALF_ANGLE + (2 * GUARD_HALF_ANGLE * i) / rayCount;
    const stepX = Math.cos(angle);
    const stepY = Math.sin(angle);
    let reach = GUARD_SIGHT_RANGE;
    for (let d = 8; d < GUARD_SIGHT_RANGE; d += 8) {
      const { tx, ty } = tileOf(guard.x + stepX * d, guard.y + stepY * d);
      if (blocksSight(tx, ty, sneaking)) {
        reach = d;
        break;
      }
    }
    points.push({ x: guard.x + stepX * reach, y: guard.y + stepY * reach });
  }
  return points;
}
