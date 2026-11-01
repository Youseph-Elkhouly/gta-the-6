// Keyboard + pointer-lock mouse input. Keeps a snapshot of held keys and
// accumulates mouse movement deltas that systems read once per frame.

export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;

  // one-shot edge events (consumed per frame)
  private pressedThisFrame = new Set<string>();

  private readonly dom: HTMLElement;
  onLockChange?: (locked: boolean) => void;

  constructor(dom: HTMLElement) {
    this.dom = dom;

    window.addEventListener("keydown", (e) => {
      const code = e.code;
      if (!this.keys.has(code)) this.pressedThisFrame.add(code);
      this.keys.add(code);
      // prevent page scroll on space / arrows while playing
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Listen on the window (not just the canvas) so a click anywhere — including
    // on the "click to capture" overlay that covers the canvas — captures the
    // pointer. requestPointerLock must target the canvas element itself.
    window.addEventListener("click", () => {
      if (!this.locked) {
        const p = this.dom.requestPointerLock();
        // Newer browsers return a promise that can reject; swallow it quietly.
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as unknown as Promise<void>).catch(() => {});
        }
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) {
        this.keys.clear();
      }
      this.onLockChange?.(this.locked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key transitioned to pressed. */
  pressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Call at the END of each frame to clear per-frame state. */
  endFrame(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pressedThisFrame.clear();
  }
}
