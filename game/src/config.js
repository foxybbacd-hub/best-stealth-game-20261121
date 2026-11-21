// Tuning and palette for Lantern Museum, the stealth game in this folder.
// One place holds every number the other modules share, so balancing the
// detection model or the level scale means editing here and nowhere else.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 16;
export const VIEW_WIDTH = COLS * TILE;
export const VIEW_HEIGHT = ROWS * TILE;

// Movement, in tiles per second.
export const PLAYER_WALK_SPEED = 3.4;
export const PLAYER_SNEAK_SPEED = 1.9;
export const GUARD_PATROL_SPEED = 2.1;
export const GUARD_CHASE_SPEED = 3.5;
export const GUARD_SEARCH_SPEED = 2.6;

// Guard senses.
export const GUARD_SIGHT_RANGE = 6.4 * TILE;
export const GUARD_HALF_ANGLE = 0.61; // radians, about 35 degrees each side
export const GUARD_HEAR_RADIUS = 5 * TILE;

// Suspicion, 0 to 100. It climbs while a guard can see the player and falls
// away while the player stays out of sight.
export const SUSPICION_MAX = 100;
export const SUSPICION_DECAY_PER_SECOND = 26;
export const SUSPICION_SEEN_CLOSE_PER_SECOND = 95;
export const SUSPICION_SEEN_FAR_PER_SECOND = 20;
export const SUSPICION_SNEAK_FACTOR = 0.45;
export const SUSPICION_SHADOW_FACTOR = 0.45;
export const SUSPICION_ALERT_AT = 100;
export const SUSPICION_WARY_AT = 55;

// Guard behaviour timers, in seconds.
export const GUARD_WAYPOINT_PAUSE = 1.4;
export const GUARD_LOSE_SIGHT_SECONDS = 2.5;
export const GUARD_SEARCH_SECONDS = 3.2;

// Player kit.
export const PLAYER_PEBBLES_START = 5;
export const PEBBLE_FLY_SECONDS = 0.38;
export const PEBBLE_THROW_COOLDOWN = 0.6;
export const RELICS_TO_WIN = 3;

// Palette. The floor is a cool blue-grey; shadow tiles are darker so the
// player can read safety at a glance; cones are warm amber, turning red
// when a guard is alerted.
export const COLOURS = {
  floorLight: '#3a4152',
  floorDark: '#343b4b',
  floorShadow: '#232936',
  wall: '#171b26',
  wallTop: '#2b3247',
  shelf: '#4a3626',
  shelfEdge: '#6b4e33',
  crate: '#7a5c33',
  crateEdge: '#a07d44',
  relic: '#ffd76a',
  exitLocked: '#c94f4f',
  exitOpen: '#58d68d',
  player: '#e8e4d8',
  playerCloak: '#7d6bb0',
  guard: '#d97b2f',
  guardAlert: '#e33e2e',
  coneCalm: 'rgba(255, 214, 106, 0.20)',
  coneWary: 'rgba(255, 178, 64, 0.30)',
  coneAlert: 'rgba(227, 62, 46, 0.34)',
  hudPanel: 'rgba(12, 14, 22, 0.78)',
  text: '#f2efe6',
  textDim: '#aab0c0',
};
