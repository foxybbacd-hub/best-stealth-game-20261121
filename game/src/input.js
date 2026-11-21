// Keyboard and mouse input, translated into the game's own key names.
// The game reads `keys` as a set ('up', 'down', 'left', 'right', 'sneak')
// and takes clicks as world coordinates, so the rest of the game never
// touches a DOM event.

const KEY_NAMES = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sneak',
  ShiftRight: 'sneak',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    /** Callbacks the game wires up: { onAction, onClick, onPause, onMute }. */
    this.handlers = {};
    this.pressed = new Set();
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      const name = KEY_NAMES[event.code];
      if (name) {
        this.keys.add(name);
        event.preventDefault();
      }
      if (event.repeat) return;
      this.pressed.add(event.code);
      if (event.code === 'Enter' || event.code === 'Space') {
        if (this.handlers.onAction) this.handlers.onAction();
        event.preventDefault();
      }
      if (event.code === 'KeyR' && this.handlers.onAction) {
        this.handlers.onAction('restart');
      }
      if (event.code === 'KeyP' && this.handlers.onPause) this.handlers.onPause();
      if (event.code === 'KeyM' && this.handlers.onMute) this.handlers.onMute();
    });
    window.addEventListener('keyup', (event) => {
      const name = KEY_NAMES[event.code];
      if (name) this.keys.delete(name);
    });
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('pointerdown', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      // The canvas keeps its aspect ratio (object-fit: contain), so the
      // drawn game may be letterboxed inside the element: map the click
      // into the drawn area, not the element box.
      const scale = Math.min(rect.width / this.canvas.width, rect.height / this.canvas.height);
      const drawnWidth = this.canvas.width * scale;
      const drawnHeight = this.canvas.height * scale;
      const offsetX = (rect.width - drawnWidth) / 2;
      const offsetY = (rect.height - drawnHeight) / 2;
      const x = ((event.clientX - rect.left - offsetX) / drawnWidth) * this.canvas.width;
      const y = ((event.clientY - rect.top - offsetY) / drawnHeight) * this.canvas.height;
      if (this.handlers.onClick) this.handlers.onClick(x, y);
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True once for a key pressed since the last frame; used for menus. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
