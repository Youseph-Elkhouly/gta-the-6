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

// Derive a normal map from a greyscale height estimate of the albedo canvas.
function normalFromCanvas(src: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const size = src.width;
  const sctx = src.getContext("2d")!;
  const img = sctx.getImageData(0, 0, size, size).data;
  const lum = (x: number, y: number) => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    const i = (yi * size + xi) * 4;
    return (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) / 255;
  };
  const [canvas, ctx] = makeCanvas(size);
  const out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength;
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength;
      // normal = normalize(-dx, -dy, 1)
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz) || 1;
      const i = (y * size + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export interface SurfaceTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

export function makeAsphaltTextures(): SurfaceTextures {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  speckle(ctx, size, [34, 36, 40], 22, 9000);
  // a few lighter aggregate flecks
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(150,150,155,${0.05 + Math.random() * 0.1})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = normalFromCanvas(canvas, 2.0);
  return { map, normalMap };
}

export function makeConcreteTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  // Light warm concrete so it reads as pavement, not dark asphalt, when it
  // multiplies the ground/sidewalk material colour.
  speckle(ctx, size, [178, 172, 160], 14, 7000);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
