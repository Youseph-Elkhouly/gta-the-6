import * as THREE from "three";
import type { LandmarkWorld, LandmarkDebugEntry } from "./index";

// Landmark debug mode: outlines each source footprint, marks the model origin and
// bounds, and floats an HTML label (name + origin + height) over each landmark.
// Toggled with the L key.

export class LandmarkDebug {
  private group = new THREE.Group();
  private labelRoot: HTMLDivElement;
  private labels: { el: HTMLDivElement; entry: LandmarkDebugEntry }[] = [];
  private _visible = false;
  private tmp = new THREE.Vector3();

  constructor(world: LandmarkWorld, scene: THREE.Scene) {
    this.group.name = "landmark-debug";
    this.group.visible = false;
    scene.add(this.group);

    const yellow = new THREE.LineBasicMaterial({ color: 0xffd166 });
    const cyan = new THREE.LineBasicMaterial({ color: 0x4ad0ff });

    for (const e of world.entries) {
      // footprint outline (closed loop) at ground level
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < e.outline.length; i += 2) {
        pts.push(new THREE.Vector3(e.outline[i], 0.5, e.outline[i + 1]));
      }
      pts.push(pts[0].clone());
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), yellow));

      // bounds box
      this.group.add(new THREE.Box3Helper(e.bounds, 0x4ad0ff));

      // origin marker: a small vertical tick + crosshair
      const o = e.originX;
      const oz = e.originZ;
      const originPts = [
        new THREE.Vector3(o, 0, oz), new THREE.Vector3(o, 14, oz),
        new THREE.Vector3(o - 6, 0.5, oz), new THREE.Vector3(o + 6, 0.5, oz),
        new THREE.Vector3(o, 0.5, oz - 6), new THREE.Vector3(o, 0.5, oz + 6),
      ];
      this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(originPts), cyan));
    }

    // HTML labels
    this.labelRoot = document.createElement("div");
    this.labelRoot.id = "landmark-labels";
    this.labelRoot.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:18;display:none;";
    for (const entry of world.entries) {
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);white-space:nowrap;" +
        "font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e8eef9;" +
        "background:rgba(12,16,22,0.82);border:1px solid rgba(74,208,255,0.5);" +
        "border-radius:6px;padding:4px 7px;text-align:center;";
      el.innerHTML =
        `<b style="color:#4ad0ff">${entry.name}</b><br>` +
        `origin ${entry.originX.toFixed(0)}, ${entry.originZ.toFixed(0)} · ${entry.heightM} m`;
      this.labelRoot.appendChild(el);
      this.labels.push({ el, entry });
    }
    document.body.appendChild(this.labelRoot);
  }

  get visible(): boolean {
    return this._visible;
  }

  toggle(): boolean {
    this._visible = !this._visible;
    this.group.visible = this._visible;
    this.labelRoot.style.display = this._visible ? "block" : "none";
    return this._visible;
  }

  update(camera: THREE.PerspectiveCamera, w: number, h: number): void {
    if (!this._visible) return;
    for (const { el, entry } of this.labels) {
      this.tmp.set(entry.originX, entry.bounds.max.y + 10, entry.originZ);
      this.tmp.project(camera);
      const behind = this.tmp.z > 1;
      if (behind || this.tmp.x < -1.2 || this.tmp.x > 1.2 || this.tmp.y < -1.2 || this.tmp.y > 1.2) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "block";
      el.style.left = `${((this.tmp.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - this.tmp.y) / 2) * h}px`;
    }
  }
}
