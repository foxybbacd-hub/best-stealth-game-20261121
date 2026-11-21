// The screenshot scenes behind ?shot=title|play|alert|win. Each one reaches
// its frame by playing the real rules forward from a fresh game with a
// scripted set of keys (the play and alert scenes), or by placing the game
// in a real end state through its own checks (the win scene), so every frame
// is what the game itself renders. Routes are found with the level's own
// pathfinder, so the staged scenes follow routes a player could really
// take. The game has no randomness, and every scene is stepped at a fixed
// 1/60 s, so the same query always gives the same frame.

import { TILE } from './config.js';
import { findPath, tileCentre } from './level.js';

const STEP = 1 / 60;
const MAX_STEPS = 60 * 120;

/** Steer the player toward tile (tx, ty) by holding the keys each tick. */
function steerToward(game, tx, ty) {
  const target = tileCentre(tx, ty);
  const dx = target.x - game.player.x;
  const dy = target.y - game.player.y;
  const keys = game.input.keys;
  keys.clear();
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return true;
  if (Math.abs(dx) > Math.abs(dy)) {
    keys.add(dx > 0 ? 'right' : 'left');
  } else {
    keys.add(dy > 0 ? 'down' : 'up');
  }
  return false;
}

/**
 * Walk the player through a list of goal tiles, following the level's own
 * paths between them, until every goal is reached, `stopWhen` says to stop,
 * or the step budget runs out. With `sneak`, the player crouches the whole
 * way. Returns how the walk ended.
 */
function walkRoute(game, goals, stopWhen = null, sneak = false) {
  let from = [Math.floor(game.player.x / TILE), Math.floor(game.player.y / TILE)];
  let path = [];
  let pathIndex = 0;
  let stuckSteps = 0;
  let lastX = game.player.x;
  let lastY = game.player.y;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (stopWhen && stopWhen(game)) return 'stopped';
    if (game.screen !== 'play') return game.screen;
    if (pathIndex >= path.length) {
      if (goals.length === 0) {
        if (stopWhen) {
          // No more walking: stand still and let the scene develop.
          game.input.keys.clear();
          game.update(STEP);
          continue;
        }
        return 'arrived';
      }
      const goal = goals.shift();
      path = findPath(from[0], from[1], goal[0], goal[1]);
      if (!path) return 'no-path';
      from = goal;
      pathIndex = 1; // the first tile is where the player stands
      if (pathIndex >= path.length) continue;
    }
    const [tx, ty] = path[pathIndex];
    if (steerToward(game, tx, ty)) pathIndex += 1;
    if (sneak) game.input.keys.add('sneak');
    game.update(STEP);
    if (Math.hypot(game.player.x - lastX, game.player.y - lastY) < 0.4) {
      stuckSteps += 1;
      if (stuckSteps > 120) return 'timeout';
    } else {
      stuckSteps = 0;
    }
    lastX = game.player.x;
    lastY = game.player.y;
  }
  return 'timeout';
}

/** Hold a key set for a number of seconds, stepping the real update. */
function holdKeys(game, keys, seconds, stopWhen = null) {
  game.input.keys.clear();
  for (const key of keys) game.input.keys.add(key);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen !== 'play') break;
    if (stopWhen && stopWhen(game)) break;
    game.update(STEP);
  }
  game.input.keys.clear();
}

function stageTitle(game) {
  game.reset();
  game.setScreen('title');
}

function stagePlay(game) {
  game.start();
  // Down the bottom wing, take the first relic, slip through the middle
  // doorway and wait, sneaking, in the corridor as Brant patrols past.
  walkRoute(game, [
    [11, 14],
    [10, 8],
    [13, 8],
  ], null, true);
  // Wait, sneaking, in the corridor as Brant patrols past, but break off
  // the wait if the meter climbs: a play shot must stay a play shot.
  holdKeys(game, ['sneak'], 2.5, (g) => g.suspicion >= 60);
}

function stageAlert(game) {
  game.start();
  // Take the first relic, climb into the middle hall, and stand on
  // Marlow's patrol line until the suspicion meter is nearly full: the near
  // miss, frozen a breath before the alarm. The wait stands the player up
  // (no sneak), so the meter climbs fast once Marlow turns the corner.
  // Stop the walk the moment the meter nears the alarm, wherever the
  // player is, and freeze there: a near miss caught mid-step is still a
  // near miss, and any longer hold would let the chase finish the job.
  walkRoute(game, [
    [11, 14],
    [11, 1],
  ], (g) => g.suspicion >= 72, true);
  walkRoute(game, [], (g) => g.suspicion >= 72);
}

function stageWin(game) {
  game.start();
  for (const relic of game.relics) relic.taken = true;
  game.relicsTaken = game.relics.length;
  game.elapsed = 132;
  game.alarms = 1;
  game.player.x = game.exit.x;
  game.player.y = game.exit.y;
  game.checkExit();
}

/**
 * Set `game` to the named scene (title, play, alert or win; any other name
 * is title). The caller freezes the game afterwards, so the frame holds.
 */
export function stageShot(name, game) {
  if (name === 'play') stagePlay(game);
  else if (name === 'alert') stageAlert(game);
  else if (name === 'win') stageWin(game);
  else stageTitle(game);
}
