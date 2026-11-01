import * as THREE from "three";

// Procedural, canvas-generated textures — keeps the app self-contained (no image
// files to download or ship) while still giving surfaces real detail: noisy
// asphalt with a matching normal map, concrete for ground/sidewalks, and a
// tiling normal map for the lake water.

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

// Value-noise-ish speckle: fill with a base colour then splatter many
// semi-transparent dots of nearby shades. Cheap and tileable enough at distance.
function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: [number, number, number],
  spread: number,
  count: number,
): void {
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const d = (Math.random() - 0.5) * 2 * spread;
    const r = Math.max(0, Math.min(255, base[0] + d));
    const g = Math.max(0, Math.min(255, base[1] + d));
    const b = Math.max(0, Math.min(255, base[2] + d));
    const a = 0.04 + Math.random() * 0.12;
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const s = 1 + Math.random() * 2.5;
    ctx.fillRect(x, y, s, s);
  }
}

export interface SurfaceTextures {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

function loadTiledTexture(path: string, colorSpace = THREE.NoColorSpace): THREE.Texture {
  const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${path}`);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  return tex;
}

export function makeAsphaltTextures(): SurfaceTextures {
  return {
    map: loadTiledTexture("asphalt-color.jpg", THREE.SRGBColorSpace),
    normalMap: loadTiledTexture("asphalt-normal.jpg"),
    roughnessMap: loadTiledTexture("asphalt-roughness.jpg"),
  };
}

export function makeConcreteTexture(): THREE.Texture {
  return loadTiledTexture("concrete-color.jpg", THREE.SRGBColorSpace);
}

export function makeConcreteTextures(): SurfaceTextures {
  return {
    map: loadTiledTexture("concrete-color.jpg", THREE.SRGBColorSpace),
    normalMap: loadTiledTexture("concrete-normal.jpg"),
    roughnessMap: loadTiledTexture("concrete-roughness.jpg"),
  };
}

// Smooth, swirly normal map for water ripples.
export function makeWaterNormals(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  // Build a soft height field from a handful of sine lobes, then convert.
  const height = new Float32Array(size * size);
  const waves = [] as { fx: number; fy: number; ph: number; amp: number }[];
  for (let i = 0; i < 6; i++) {
    waves.push({
      fx: (Math.random() * 2 - 1) * 0.08,
      fy: (Math.random() * 2 - 1) * 0.08,
      ph: Math.random() * Math.PI * 2,
      amp: 0.5 + Math.random() * 0.5,
    });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin(x * w.fx + y * w.fy + w.ph) * w.amp;
      height[y * size + x] = h;
    }
  }
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const strength = 1.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz) || 1;
      const i = (y * size + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
