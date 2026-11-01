import * as THREE from "three";
import { makeInverseProjector, type InverseProjector } from "./projection";

/** Small developer overlay for comparing the live scene with Google Street View. */
export class StreetViewPanel {
  private root: HTMLDivElement;
  private frame: HTMLIFrameElement;
  private link: HTMLAnchorElement;
  private label: HTMLSpanElement;
  private lastPosition?: THREE.Vector3;
  private lastDirection?: THREE.Vector3;
  private inverse: InverseProjector;

  constructor(
    private camera: THREE.Camera,
    centerLat: number,
    centerLon: number,
    private getPosition: () => THREE.Vector3,
  ) {
    this.inverse = makeInverseProjector(centerLat, centerLon);
    this.root = document.createElement("div");
    this.root.id = "street-view-panel";
    this.root.innerHTML = `
      <header><strong>STREET VIEW</strong><span class="sv-location">—</span>
      <button type="button" aria-label="Close Street View">×</button></header>
      <iframe title="Google Street View comparison" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      <footer><span>Move through the scene to update the comparison</span>
      <a target="_blank" rel="noreferrer">Open in Google Maps ↗</a></footer>`;
    document.body.appendChild(this.root);
    this.frame = this.root.querySelector("iframe")!;
    this.link = this.root.querySelector("a")!;
    this.label = this.root.querySelector(".sv-location")!;
    this.root.querySelector("button")!.addEventListener("click", () => this.setVisible(false));
    this.link.addEventListener("click", (event) => event.stopPropagation());
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyV" && !event.repeat && !(event.target instanceof HTMLInputElement)) {
        this.setVisible(!this.root.classList.contains("visible"));
      }
    });
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.update();
  }

  updatePosition(): void {
    if (!this.root.classList.contains("visible")) return;
    const p = this.getPosition();
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    if (!this.lastPosition || this.lastPosition.distanceTo(p) >= 20 ||
        !this.lastDirection || this.lastDirection.angleTo(direction) >= THREE.MathUtils.degToRad(20)) {
      this.update();
    }
  }

  private update(): void {
    const p = this.getPosition();
    this.lastPosition = p.clone();
    const { lat, lon } = this.inverse(p.x, p.z);
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    this.lastDirection = direction.clone();
    const heading = (Math.atan2(direction.x, -direction.z) * 180 / Math.PI + 360) % 360;
    const latLon = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    this.label.textContent = latLon;
    this.link.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLon}&heading=${heading.toFixed(0)}`;
    const cbp = `,0,${heading.toFixed(0)},0,0`;
    this.frame.src = `https://www.google.com/maps?layer=c&cbll=${latLon}&cbp=${encodeURIComponent(cbp)}&output=svembed`;
  }

  private setVisible(visible: boolean): void {
    this.root.classList.toggle("visible", visible);
    if (visible) this.update();
  }
}
