import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export type Quality = "high" | "medium" | "low";
export const QUALITY_CYCLE: Quality[] = ["high", "medium", "low"];

// Post-processing pipeline: ambient occlusion (contact shadows), subtle bloom on
// bright glass/sky, and SMAA anti-aliasing. Quality degrades gracefully:
//   high   = AO + bloom + SMAA
//   medium = bloom + SMAA (no AO)
//   low    = direct render (MSAA only), composer bypassed
export class Graphics {
  private composer: EffectComposer;
  private gtao: GTAOPass;
  private bloom: UnrealBloomPass;
  private smaa: SMAAPass;
  quality: Quality = "high";

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.gtao = new GTAOPass(scene, camera, w, h);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.updateGtaoMaterial({ radius: 4.0, scale: 1.0, thickness: 1.0 });
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);

    // Bloom runs on pre-tonemap HDR, where the sky luminance is >> 1. Keep the
    // threshold at ~1.0 so only genuine highlights (sun glints on glass) bloom,
    // not the whole bright sky — otherwise the image turns milky.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.4, 1.0);
    this.composer.addPass(this.bloom);

    this.smaa = new SMAAPass(w, h);
    this.composer.addPass(this.smaa);

    this.composer.addPass(new OutputPass());

    this.setQuality("high");
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.gtao.enabled = q === "high";
    this.bloom.enabled = q !== "low";
    this.smaa.enabled = q !== "low";
  }

  cycleQuality(): Quality {
    const i = QUALITY_CYCLE.indexOf(this.quality);
    this.setQuality(QUALITY_CYCLE[(i + 1) % QUALITY_CYCLE.length]);
    return this.quality;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.gtao.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  render(): void {
    if (this.quality === "low") {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }
}
