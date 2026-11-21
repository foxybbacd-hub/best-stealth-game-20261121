// The museum floor plan for Lantern Museum, and the tile queries the rest of
// the game asks about it. The map is plain text so the level can be read and
// reworked without touching any other file.
//
// Legend: # wall, . lit floor, , shadow floor (dark, harder to be seen in),
// S tall shelf (blocks movement and sight), C crate (blocks movement; blocks
// sight only against a sneaking player crouched behind it), R relic,
// E exit, P where the player starts.
import { COLS, ROWS, TILE } from './config.js';

export const MAP = [
  '########################',
  '#......#.......#....R..#',
  '#..S...#...S...#.......#',
  '#......#.......#...S...#',
  '#..C...#...C...#.......#',
  '#......#.......#...C..E#',
  '###.######.#####.####..#',
  '#,,,,,,,,,,,,,,,,,,,,,,#',
  '#......................#',
  '#..S...#.......#...S...#',
  '#......#...C...#.......#',
  '#......#.......#...C...#',
  '###.######.#####.####..#',
  '#......#.......#....R..#',
  '#P.....#...R...#.......#',
  '########################',
];

export function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return MAP[ty][tx];
}

export function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/** A tile the player or a guard cannot walk through. */
export function blocksMovement(tx, ty) {
  const tile = tileAt(tx, ty);
  return tile === '#' || tile === 'S' || tile === 'C';
}

/**
 * A tile that stops a guard's line of sight. Walls and shelves always do;
 * a crate only hides a player who is sneaking low behind it.
 */
export function blocksSight(tx, ty, sneaking) {
  const tile = tileAt(tx, ty);
  if (tile === '#' || tile === 'S') return true;
  return sneaking && tile === 'C';
}

/** A dark tile: standing in shadow slows how fast suspicion climbs. */
export function isShadow(tx, ty) {
  return tileAt(tx, ty) === ',';
}

function findAll(symbol) {  const found = [];
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      if (MAP[ty][tx] === symbol) found.push({ tx, ty, ...tileCentre(tx, ty) });
    }
  }
  return found;
}

/** Everything the game needs to place its actors, read from the map text. */
export function parseLevel() {
  const playerStart = findAll('P')[0];
  const exitTile = findAll('E')[0];
  const relics = findAll('R').map((spot) => ({ ...spot, taken: false }));
  return { playerStart, exit: exitTile, relics };
}

/**
 * Flood-fill from the player start over walkable tiles and name any relic
 * or exit tile it cannot reach. Empty means the level is winnable.
 */
export function unreachableGoals() {  const { playerStart, exit, relics } = parseLevel();
  const seen = new Set([`${playerStart.tx},${playerStart.ty}`]);
  const queue = [[playerStart.tx, playerStart.ty]];
  while (queue.length > 0) {
    const [tx, ty] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || blocksMovement(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  const missing = [];
  for (const goal of [...relics, { ...exit, label: 'exit' }]) {
    if (!seen.has(`${goal.tx},${goal.ty}`)) missing.push(`${goal.tx},${goal.ty}`);
  }
  return missing;
}

/**
 * Move a circle of `radius` by (dx, dy) through the tile grid, sliding along
 * walls instead of sticking: try the full step, then each axis on its own.
 * Returns the new position. The player and the guards share this so both
 * collide with the walls the same way.
 */
export function slideMove(x, y, dx, dy, radius) {
  const touchesWall = (px, py) => {
    const left = Math.floor((px - radius) / TILE);
    const right = Math.floor((px + radius) / TILE);
    const top = Math.floor((py - radius) / TILE);
    const bottom = Math.floor((py + radius) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (!blocksMovement(tx, ty)) continue;
        // True circle-against-tile test: the closest point of the tile's
        // rectangle to the circle's centre, so a doorway's corners do not
        // catch a circle that only brushes them.
        const closestX = Math.max(tx * TILE, Math.min(px, tx * TILE + TILE));
        const closestY = Math.max(ty * TILE, Math.min(py, ty * TILE + TILE));
        if (Math.hypot(px - closestX, py - closestY) < radius) return true;
      }
    }
    return false;
  };
  let nx = x;
  let ny = y;
  if (!touchesWall(x + dx, y)) nx = x + dx;
  if (!touchesWall(nx, y + dy)) ny = y + dy;
  return { x: nx, y: ny };
}

/**
 * Breadth-first path over walkable tiles, from one tile to another, as a
 * list of [tx, ty] tiles including both ends, or null when no route exists.
 * The screenshot staging walks these paths, so the staged scenes follow
 * routes a player could really take.
 */
export function findPath(fromTx, fromTy, toTx, toTy) {
  const key = (x, y) => `${x},${y}`;
  const previous = new Map([[key(fromTx, fromTy), null]]);
  const queue = [[fromTx, fromTy]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (previous.has(key(nx, ny)) || blocksMovement(nx, ny)) continue;
      previous.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!previous.has(key(toTx, toTy))) return null;
  const path = [];
  let node = [toTx, toTy];
  while (node) {
    path.unshift(node);
    node = previous.get(key(node[0], node[1]));
  }
  return path;
}
