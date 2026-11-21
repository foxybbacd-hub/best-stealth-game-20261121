// Lantern Museum: the game itself. Owns the screens (title, play, paused,
// win, lose), the loop, the shared suspicion meter, relic and exit checks,
// and the wiring between the player, the guards, the sound engine and the
// renderer. The ?shot= query (see shots.js) stages a frozen scene for
// screenshots; a normal visit starts on the title screen.

import {
  COLS,
  ROWS,
  SUSPICION_ALERT_AT,
  SUSPICION_DECAY_PER_SECOND,
  SUSPICION_MAX,
  GUARD_HEAR_RADIUS,
} from './config.js';
import { parseLevel } from './level.js';
import { guardCanSee, suspicionPerSecond } from './detection.js';
import { Guard, GUARD_ROSTER } from './guards.js';
import { Player } from './player.js';
import { SoundEngine } from './audio.js';
import { render } from './render.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = { cols: COLS, rows: ROWS };
    const parsed = parseLevel();
    this.playerStart = parsed.playerStart;
    this.exit = parsed.exit;
    this.relics = parsed.relics;
    this.player = new Player(this.playerStart);
    this.guards = GUARD_ROSTER.map((entry) => new Guard(entry));
    this.sound = new SoundEngine();
    this.input = new Input(canvas);
    this.screen = 'title';
    this.suspicion = 0;
    this.elapsed = 0;
    this.alarms = 0;
    this.caughtBy = '';
    this.bestTime = null;
    this.frozen = false;
    this.wasWary = false;
    this.statusLine = document.getElementById('status');
    this.lastFrame = 0;
    this.relicsTaken = 0;
    this.wireInput();
  }

  get relicsTakenCount() {
    return this.relics.filter((relic) => relic.taken).length;
  }

  wireInput() {
    this.input.handlers.onAction = (kind) => {
      this.sound.unlock();
      if (kind === 'restart') {
        if (this.screen === 'win' || this.screen === 'lose') this.restart();
        return;
      }
      if (this.screen === 'title') this.start();
      else if (this.screen === 'win' || this.screen === 'lose') this.restart();
    };
    this.input.handlers.onClick = (x, y) => {
      this.sound.unlock();
      if (this.screen === 'title') {
        this.start();
        return;
      }
      if (this.screen === 'win' || this.screen === 'lose') {
        this.restart();
        return;
      }
      if (this.screen !== 'play') return;
      // Aim in world coordinates: the canvas is the whole level, one to one.
      if (this.player.throwPebble(x, y)) {
        this.sound.tone(880, 0.05, 'sine', 0.06);
      }
    };
    this.input.handlers.onPause = () => {
      if (this.screen === 'play') this.setScreen('paused');
      else if (this.screen === 'paused') this.setScreen('play');
    };
    this.input.handlers.onMute = () => {
      this.sound.muted = !this.sound.muted;
    };
    this.input.attach();
  }

  setScreen(screen) {
    this.screen = screen;
    const messages = {
      title: 'Lantern Museum. Title screen. Press Enter to begin.',
      play: 'Playing. Stay out of the guards’ vision cones and collect three relics.',
      paused: 'Paused.',
      win: 'You slipped away with all three relics.',
      lose: `Caught by ${this.caughtBy}. Press R to try again.`,
    };
    if (this.statusLine) this.statusLine.textContent = messages[screen] ?? '';
  }

  reset() {
    this.player.reset(this.playerStart);
    this.guards = GUARD_ROSTER.map((entry) => new Guard(entry));
    for (const relic of this.relics) relic.taken = false;
    this.suspicion = 0;
    this.elapsed = 0;
    this.alarms = 0;
    this.caughtBy = '';
    this.wasWary = false;
    this.relicsTaken = 0;
  }

  start() {
    this.reset();
    this.setScreen('play');
  }

  restart() {
    this.start();
  }

  /** The player stepped on a relic tile: take it, chime, maybe unlock. */
  checkRelics() {
    for (const relic of this.relics) {
      if (relic.taken) continue;
      if (Math.hypot(this.player.x - relic.x, this.player.y - relic.y) < 26) {
        relic.taken = true;
        this.relicsTaken = this.relicsTakenCount;
        this.sound.pickupChime();
        if (this.relicsTaken >= this.relics.length) this.sound.unlockChime();
      }
    }
  }

  checkExit() {
    if (this.relicsTaken < this.relics.length) return;
    if (Math.hypot(this.player.x - this.exit.x, this.player.y - this.exit.y) < 28) {
      const minutes = Math.floor(this.elapsed / 60);
      const seconds = Math.floor(this.elapsed % 60);
      this.bestTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
      this.sound.winJingle();
      this.setScreen('win');
    }
  }

  update(dt) {
    if (this.screen !== 'play' || this.frozen) return;
    this.elapsed += dt;

    const playerEvent = this.player.update(dt, this.input.keys);
    if (playerEvent && playerEvent.step) this.sound.footstep(this.player.sneaking);
    if (playerEvent && playerEvent.landed) {
      this.sound.pebbleClink();
      for (const guard of this.guards) {
        const distance = Math.hypot(guard.x - playerEvent.landed.x, guard.y - playerEvent.landed.y);
        if (distance <= GUARD_HEAR_RADIUS) guard.hearNoise(playerEvent.landed.x, playerEvent.landed.y);
      }
    }

    // Every guard that can see the player feeds the shared suspicion meter.
    let seenByAnyone = false;
    let rise = 0;
    const views = this.guards.map((guard) => {
      const canSee = guardCanSee(guard, this.player.x, this.player.y, this.player.sneaking);
      if (canSee) {
        seenByAnyone = true;
        rise += suspicionPerSecond(guard, this.player.x, this.player.y, this.player.sneaking);
      }
      return { guard, canSee };
    });
    if (seenByAnyone) {
      this.suspicion = Math.min(SUSPICION_MAX, this.suspicion + Math.min(rise, 130) * dt);
    } else {
      this.suspicion = Math.max(0, this.suspicion - SUSPICION_DECAY_PER_SECOND * dt);
    }
    if (!this.wasWary && this.suspicion >= 55 && this.suspicion < SUSPICION_ALERT_AT) {
      this.sound.waryBlip();
    }
    this.wasWary = this.suspicion >= 55;

    const events = [];
    for (const { guard, canSee } of views) {
      guard.update(
        dt,
        {
          playerX: this.player.x,
          playerY: this.player.y,
          canSee,
          suspicion: this.suspicion,
          onStep: (steppingGuard) => {
            const distance = Math.hypot(steppingGuard.x - this.player.x, steppingGuard.y - this.player.y);
            this.sound.guardStep(distance, steppingGuard.x - this.player.x);
          },
        },
        events,
      );
    }
    for (const event of events) {
      if (event.type === 'alert') {
        this.alarms += 1;
        this.sound.alertSting();
      } else if (event.type === 'caught') {
        this.caughtBy = event.guard.name;
        this.sound.loseJingle();
        this.setScreen('lose');
        return;
      }
    }

    this.checkRelics();
    this.checkExit();
  }

  frame(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastFrame) / 1000 || 0);
    this.lastFrame = timestamp;
    this.update(dt);
    render(this.ctx, this);
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  run() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      stageShot(shot, this);
      this.frozen = true;
      this.setScreen(this.screen);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

// Boot: one game for the page, reachable as window.__game so a play-test
// (or a curious player with devtools) can inspect the live state.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
game.run();
