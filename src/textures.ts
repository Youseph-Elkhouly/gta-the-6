import * as THREE from "three";

// Local ambientCG maps provide asphalt/concrete PBR detail; the water normal is
// generated in a canvas so the lake has no remote asset dependency.

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

export interface SurfaceTextures {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

function loadTiledTexture(path: string, colorSpace: THREE.ColorSpace = THREE.NoColorSpace): THREE.Texture {
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
