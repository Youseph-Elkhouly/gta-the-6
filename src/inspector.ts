import * as THREE from "three";
import type { BuildingWorld } from "./buildings";
import type { BuildingFeature } from "./types";

// Click a building to inspect its source metadata (ID, height, sources) and
// highlight it in the scene.
export class Inspector {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private panel = document.getElementById("inspector")!;
  private elId = document.getElementById("insp-id")!;
  private elHeight = document.getElementById("insp-height")!;
  private elBase = document.getElementById("insp-base")!;
  private elHsrc = document.getElementById("insp-hsrc")!;
  private elBsrc = document.getElementById("insp-bsrc")!;
  private elDataset = document.getElementById("insp-dataset")!;

  private highlight?: THREE.LineSegments;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    private world: BuildingWorld,
    private scene: THREE.Scene,
  ) {
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      // Only pick when the mouse is NOT locked (i.e. the user intends to click a
      // building, not steer). While locked the crosshair is centred.
      if (document.pointerLockElement === this.renderer.domElement) {
        // locked: pick at screen centre (crosshair)
        this.mouse.set(0, 0);
        this.pick();
      } else if (e.button === 0) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.pick();
      }
    });
  }

  private pick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.world.group, true);
    if (hits.length === 0) {
      this.clear();
      return;
    }
    const hit = hits[0];
    const mesh = hit.object as THREE.Mesh;
    const faceIndex = hit.faceIndex ?? -1;
    if (faceIndex < 0) {
      this.clear();
      return;
    }
    const id = this.world.pickTriangle(mesh, faceIndex);
    if (!id) {
      this.clear();
      return;
    }
    const feature = this.world.meta.get(id);
    if (feature) this.show(feature);
  }

  private show(f: BuildingFeature): void {
    this.panel.classList.add("visible");
    this.elId.textContent = f.id;
    this.elHeight.textContent = `${f.h.toFixed(1)} m`;
    this.elBase.textContent = `${f.b.toFixed(1)} m MSL`;
    this.elHsrc.textContent = f.hs || "—";
    this.elBsrc.textContent = f.bs || "—";
    this.elDataset.textContent = "Toronto 3D Massing 2025";
    this.highlightBuilding(f);
  }

  private clear(): void {
    this.panel.classList.remove("visible");
    this.removeHighlight();
  }

  private removeHighlight(): void {
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      (this.highlight.material as THREE.Material).dispose();
      this.highlight = undefined;
    }
  }

  // Draw a yellow wireframe prism around the selected building footprint.
  private highlightBuilding(f: BuildingFeature): void {
    this.removeHighlight();
    const ring = f.rings[0];
    if (!ring) return;
    const n = ring.length / 2;
    const positions: number[] = [];
    const top = f.h + 0.3;
    for (let i = 0; i < n; i++) {
      const x0 = ring[i * 2];
      const z0 = ring[i * 2 + 1];
      const j = (i + 1) % n;
      const x1 = ring[j * 2];
      const z1 = ring[j * 2 + 1];
      // bottom edge
      positions.push(x0, 0.1, z0, x1, 0.1, z1);
      // top edge
      positions.push(x0, top, z0, x1, top, z1);
      // vertical edge
      positions.push(x0, 0.1, z0, x0, top, z0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffd166 });
    this.highlight = new THREE.LineSegments(geo, mat);
    this.highlight.name = "building-highlight";
    this.scene.add(this.highlight);
  }
}
