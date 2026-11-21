// Everything drawn on the canvas: the museum floor, the guards and their
// vision cones, the player, and the HUD and title, win, lose and pause
// screens. The renderer only reads game state; it never changes it.

import { COLOURS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { visionConePolygon } from './detection.js';
import { tileAt } from './level.js';

function coneColourFor(guard) {
  if (guard.state === 'chase') return COLOURS.coneAlert;
  if (guard.state === 'suspicious' || guard.state === 'investigate' || guard.state === 'search') {
    return COLOURS.coneWary;
  }
  return COLOURS.coneCalm;
}

function drawFloor(ctx, level) {
  for (let ty = 0; ty < level.rows; ty += 1) {
    for (let tx = 0; tx < level.cols; tx += 1) {
      const tile = tileAt(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (tile === '#') {
        ctx.fillStyle = COLOURS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLOURS.wallTop;
        ctx.fillRect(x, y, TILE, 4);
        continue;
      }
      ctx.fillStyle = (tx + ty) % 2 === 0 ? COLOURS.floorLight : COLOURS.floorDark;
      ctx.fillRect(x, y, TILE, TILE);
      if (tile === ',') {
        ctx.fillStyle = COLOURS.floorShadow;
        ctx.fillRect(x, y, TILE, TILE);
      }
      if (tile === 'S') {
        ctx.fillStyle = COLOURS.shelf;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = COLOURS.shelfEdge;
        ctx.fillRect(x + 3, y + 3, TILE - 6, 4);
        ctx.fillRect(x + 3, y + TILE - 7, TILE - 6, 4);
        ctx.fillStyle = 'rgba(255, 220, 150, 0.25)';
        ctx.fillRect(x + 8, y + 12, TILE - 16, 3);
        ctx.fillRect(x + 8, y + 24, TILE - 16, 3);
      } else if (tile === 'C') {
        ctx.fillStyle = COLOURS.crate;
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.strokeStyle = COLOURS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + TILE - 5, y + TILE - 5);
        ctx.moveTo(x + TILE - 5, y + 5);
        ctx.lineTo(x + 5, y + TILE - 5);
        ctx.stroke();
      }
    }
  }
}

function drawRelicsAndExit(ctx, game) {
  const pulse = 0.6 + 0.4 * Math.sin(game.elapsed * 3);
  for (const relic of game.relics) {
    if (relic.taken) continue;
    ctx.save();
    ctx.translate(relic.x, relic.y);
    ctx.fillStyle = `rgba(255, 215, 106, ${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + 4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLOURS.relic;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  const exit = game.exit;
  const open = game.relicsTaken >= game.relics.length;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.fillStyle = open
    ? `rgba(88, 214, 141, ${0.25 + 0.2 * pulse})`
    : 'rgba(201, 79, 79, 0.22)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? COLOURS.exitOpen : COLOURS.exitLocked;
  ctx.fillRect(-13, -16, 26, 32);
  ctx.fillStyle = '#10131c';
  ctx.font = 'bold 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCK', 0, 3);
  ctx.restore();
}

function drawVisionCones(ctx, game) {
  for (const guard of game.guards) {
    const polygon = visionConePolygon(guard, game.player.sneaking);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fillStyle = coneColourFor(guard);
    ctx.fill();
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    const alerted = guard.state === 'chase';
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alerted ? COLOURS.guardAlert : COLOURS.guard;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7e8c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(guard.facing);
    ctx.fillStyle = '#f7e8c8';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(2, -6);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.textDim;
    ctx.fillText(guard.name, guard.x, guard.y + 28);
    let mark = '';
    if (guard.state === 'chase') mark = '!!';
    else if (guard.state === 'suspicious') mark = '?';
    else if (guard.state === 'investigate' || guard.state === 'search') mark = '…';
    if (mark) {
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillStyle = alerted ? '#ff6b5e' : '#ffd76a';
      ctx.fillText(mark, guard.x, guard.y - 20);
    }
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  const pebble = player.pebblePosition();
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.facing);
  ctx.fillStyle = COLOURS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = COLOURS.player;
  ctx.beginPath();
  ctx.arc(0, 0, player.sneaking ? 8 : 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOURS.playerCloak;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  if (player.sneaking) {
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9b8ff';
    ctx.fillText('sneaking', player.x, player.y - 20);
  }
  if (pebble) {
    ctx.fillStyle = '#d8d2c0';
    ctx.beginPath();
    ctx.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (player.pebbleLanded) {
    const progress = 1 - player.pebbleLanded.ringLeft / 0.9;
    ctx.strokeStyle = `rgba(255, 215, 106, ${1 - progress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.pebbleLanded.x, player.pebbleLanded.y, 6 + 34 * progress, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSuspicionMeter(ctx, game) {
  const width = 260;
  const height = 14;
  const x = (VIEW_WIDTH - width) / 2;
  const y = 10;
  ctx.fillStyle = COLOURS.hudPanel;
  ctx.fillRect(x - 10, y - 6, width + 20, height + 26);
  ctx.fillStyle = '#222838';
  ctx.fillRect(x, y, width, height);
  const ratio = game.suspicion / 100;
  ctx.fillStyle = ratio < 0.55 ? '#58d68d' : ratio < 0.85 ? '#f5b942' : '#e33e2e';
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = 'rgba(242, 239, 230, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  const label =
    game.suspicion >= 100 ? 'SPOTTED!' : game.suspicion >= 55 ? 'THEY SAW SOMETHING…' : 'UNSEEN';
  ctx.fillText(`SUSPICION: ${label}`, x + width / 2, y + height + 13);
}

function drawHud(ctx, game) {
  ctx.fillStyle = COLOURS.hudPanel;
  ctx.fillRect(0, 0, VIEW_WIDTH, 40);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('LANTERN MUSEUM', 12, 17);
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = COLOURS.textDim;
  ctx.fillText('night shift · the archive wing', 12, 32);
  drawSuspicionMeter(ctx, game);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 13px Georgia, serif';
  const minutes = Math.floor(game.elapsed / 60);
  const seconds = Math.floor(game.elapsed % 60);
  ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, VIEW_WIDTH - 12, 17);
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = COLOURS.textDim;
  ctx.fillText(
    `relics ${game.relicsTaken}/${game.relics.length}   pebbles ${game.player.pebbles}   alarms ${game.alarms}`,
    VIEW_WIDTH - 12,
    32,
  );
  ctx.fillStyle = 'rgba(12, 14, 22, 0.55)';
  ctx.fillRect(0, VIEW_HEIGHT - 24, VIEW_WIDTH, 24);
  ctx.fillStyle = COLOURS.textDim;
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / arrows move · Shift sneak · click to throw a pebble · P pause · M mute',
    VIEW_WIDTH / 2,
    VIEW_HEIGHT - 8,
  );
}

function panel(ctx, title, lines, accent) {
  const height = 100 + lines.length * 30 + 24;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.82)';
  ctx.fillRect(180, 130, VIEW_WIDTH - 360, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(180, 130, VIEW_WIDTH - 360, height);
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_WIDTH / 2, 190);
  ctx.fillStyle = COLOURS.text;
  ctx.font = '16px Georgia, serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_WIDTH / 2, 240 + i * 30);
  });
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  panel(
    ctx,
    'LANTERN MUSEUM',
    [
      'The archive wing, after closing. You are Wren, the night archivist,',
      'here to take back three relics that were never meant to be locked away.',
      '',
      'Slip past the guards. Stay out of the amber cones. Crouch behind',
      'crates, keep to the dark floor, and throw a pebble to pull a guard',
      'off their patrol. Reach the green exit with all three relics.',
      '',
      'WASD / arrows: move      Shift: sneak      Click: throw a pebble',
      '',
      'Press Enter or click to begin.',
    ],
    '#ffd76a',
  );
  if (game.bestTime !== null) {
    ctx.fillStyle = COLOURS.textDim;
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Best escape: ${game.bestTime}`, VIEW_WIDTH / 2, 470);
  }
}

function rankFor(timeSeconds, alarms) {
  if (alarms === 0 && timeSeconds < 150) return 'GHOST: never even a whisper';
  if (alarms === 0) return 'SHADOW: never once spotted';
  if (alarms <= 1) return 'CAT BURGLAR: one close call';
  return 'LOUD THIEF: they know your name now';
}

function drawEnd(ctx, game) {
  const won = game.screen === 'win';
  ctx.fillStyle = won ? 'rgba(8, 18, 12, 0.72)' : 'rgba(20, 8, 8, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (won) {
    const minutes = Math.floor(game.elapsed / 60);
    const seconds = Math.floor(game.elapsed % 60);
    panel(
      ctx,
      'YOU SLIPPED AWAY',
      [
        `All three relics, out the green door, unseen enough to matter.`,
        `Time ${minutes}:${String(seconds).padStart(2, '0')}   ·   alarms raised ${game.alarms}`,
        rankFor(game.elapsed, game.alarms),
        '',
        'Press R to play again.',
      ],
      '#58d68d',
    );
  } else {
    panel(
      ctx,
      'CAUGHT',
      [
        `${game.caughtBy} caught you in the archive wing.`,
        `Relics recovered ${game.relicsTaken} of ${game.relics.length}.`,
        '',
        'Watch the patrols, wait for the cone to turn,',
        'and remember: the dark floor is your friend.',
        '',
        'Press R to try again.',
      ],
      '#e33e2e',
    );
  }
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 8);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = COLOURS.textDim;
  ctx.fillText('Press P to carry on.', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 24);
}

/** Draw one frame of the game for the current screen. */
export function render(ctx, game) {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawFloor(ctx, game.level);
  if (game.screen !== 'title') {
    drawRelicsAndExit(ctx, game);
    drawVisionCones(ctx, game);
    drawGuards(ctx, game);
    drawPlayer(ctx, game);
  } else {
    drawRelicsAndExit(ctx, game);
    drawVisionCones(ctx, game);
    drawGuards(ctx, game);
  }
  if (game.screen === 'play' || game.screen === 'paused') {
    drawHud(ctx, game);
  }
  if (game.screen === 'title') drawTitle(ctx, game);
  if (game.screen === 'win' || game.screen === 'lose') drawEnd(ctx, game);
  if (game.screen === 'paused') drawPause(ctx);
  // A soft vignette so the edges fall away and the lit middle reads as safe.
  const vignette = ctx.createRadialGradient(
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    VIEW_HEIGHT * 0.42,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    VIEW_HEIGHT * 0.85,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}
