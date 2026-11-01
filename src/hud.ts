// Debug overlay: FPS, player coordinates, loaded building count, current chunk,
// camera mode. Driven once per frame from the main loop.

export class Hud {
  private fps = document.getElementById("fps-v")!;
  private posX = document.getElementById("pos-x")!;
  private posZ = document.getElementById("pos-z")!;
  private posY = document.getElementById("pos-y")!;
  private bldg = document.getElementById("bldg-count")!;
  private chunk = document.getElementById("chunk-id")!;
  private cam = document.getElementById("cam-mode")!;
  private gfx = document.getElementById("gfx-q")!;

  private frames = 0;
  private acc = 0;
  private lastFps = 0;

  setBuildingCount(n: number): void {
    this.bldg.textContent = String(n);
  }

  // Called every frame with dt (seconds); updates FPS ~4x/sec.
  tickFps(dt: number): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.25) {
      this.lastFps = Math.round(this.frames / this.acc);
      this.frames = 0;
      this.acc = 0;
      this.fps.textContent = String(this.lastFps);
      this.fps.className = "v " + (this.lastFps >= 50 ? "good" : this.lastFps >= 30 ? "mid" : "bad");
    }
  }

  setPosition(x: number, y: number, z: number): void {
    this.posX.textContent = x.toFixed(1);
    this.posZ.textContent = z.toFixed(1);
    this.posY.textContent = y.toFixed(2);
  }

  setChunk(cx: number, cz: number): void {
    this.chunk.textContent = `${cx}, ${cz}`;
  }

  setCameraMode(mode: string): void {
    this.cam.textContent = mode;
  }

  setGraphics(quality: string): void {
    this.gfx.textContent = quality;
  }
}
