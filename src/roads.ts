import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RoadsDoc } from "./types";
import { makeAsphaltTextures, makeConcreteTexture } from "./textures";

// Classes rendered as narrow light "paths" (sidewalks / cycleways) rather than
// dark vehicular asphalt. These also get no centre-line markings.
const PATH_CLASSES = new Set(["footway", "path", "cycleway", "pedestrian", "track", "steps"]);

const TILE_M = 7; // metres per texture tile along/across a road

function asphaltMaterial(): THREE.MeshStandardMaterial {
  const { map, normalMap } = makeAsphaltTextures();
  return new THREE.MeshStandardMaterial({
    color: 0x3a3d43,
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function pathMaterial(): THREE.MeshStandardMaterial {
  const map = makeConcreteTexture();
  map.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({
    color: 0x7a7e85,
    map,
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

// Dashed centre-line texture (white dashes on transparent), tiled along length.
function laneMarkingMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 8, 64);
  ctx.fillStyle = "rgba(240,224,120,1)"; // warm white / faded yellow
  ctx.fillRect(2, 0, 4, 34); // dash occupies ~53% of the period => dash+gap
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.4,
    roughness: 0.6,
    metalness: 0.0,
    emissive: 0x3a3320,
    emissiveMap: tex,
    emissiveIntensity: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

// Build a flat ribbon geometry along a polyline, with UVs.
// U spans the width (0..widthTiles), V runs along the length in `vScale` units.
function ribbon(pts: number[], width: number, y: number, vScale: number): THREE.BufferGeometry | null {
  const n = pts.length / 2;
  if (n < 2) return null;
  const half = width / 2;
  const widthTiles = Math.max(width / TILE_M, 0.25);

  const left: number[] = [];
  const right: number[] = [];
  const dist: number[] = [];
  let acc = 0;

  for (let i = 0; i < n; i++) {
    const x = pts[i * 2];
    const z = pts[i * 2 + 1];
    if (i > 0) acc += Math.hypot(x - pts[(i - 1) * 2], z - pts[(i - 1) * 2 + 1]);
    dist.push(acc);

    let dx = 0;
    let dz = 0;
    if (i > 0) {
      dx += x - pts[(i - 1) * 2];
      dz += z - pts[(i - 1) * 2 + 1];
    }
    if (i < n - 1) {
      dx += pts[(i + 1) * 2] - x;
      dz += pts[(i + 1) * 2 + 1] - z;
    }
    const len = Math.hypot(dx, dz) || 1e-9;
    dx /= len;
    dz /= len;
    const nx = -dz;
    const nz = dx;
    left.push(x + nx * half, y, z + nz * half);
    right.push(x - nx * half, y, z - nz * half);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    const L0 = [left[a], left[a + 1], left[a + 2]];
    const L1 = [left[b], left[b + 1], left[b + 2]];
    const R0 = [right[a], right[a + 1], right[a + 2]];
    const R1 = [right[b], right[b + 1], right[b + 2]];
    const v0 = dist[i] / vScale;
    const v1 = dist[i + 1] / vScale;
    // L0,R0,L1 ; R0,R1,L1
    positions.push(...L0, ...R0, ...L1, ...R0, ...R1, ...L1);
    for (let k = 0; k < 6; k++) normals.push(0, 1, 0);
    uvs.push(0, v0, widthTiles, v0, 0, v1, widthTiles, v0, widthTiles, v1, 0, v1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

export interface RoadWorld {
  group: THREE.Group;
  count: number;
}

export function buildRoads(doc: RoadsDoc): RoadWorld {
  const group = new THREE.Group();
  group.name = "roads";

  const roadGeos: THREE.BufferGeometry[] = [];
  const pathGeos: THREE.BufferGeometry[] = [];
  const markGeos: THREE.BufferGeometry[] = [];

  for (const r of doc.roads) {
    const isPath = PATH_CLASSES.has(r.cls);
    const y = isPath ? 0.04 : 0.05;
    const g = ribbon(r.pts, r.width, y, TILE_M);
    if (!g) continue;
    (isPath ? pathGeos : roadGeos).push(g);

    // Dashed centre line on wider vehicular roads only.
    if (!isPath && r.width >= 7) {
      const m = ribbon(r.pts, 0.22, 0.075, 6); // 6 m dash period
      if (m) markGeos.push(m);
    }
  }

  if (roadGeos.length) {
    const merged = mergeGeometries(roadGeos, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, asphaltMaterial());
      mesh.receiveShadow = true;
      mesh.name = "roads-asphalt";
      group.add(mesh);
    }
    for (const g of roadGeos) g.dispose();
  }
  if (pathGeos.length) {
    const merged = mergeGeometries(pathGeos, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, pathMaterial());
      mesh.receiveShadow = true;
      mesh.name = "roads-paths";
      group.add(mesh);
    }
    for (const g of pathGeos) g.dispose();
  }
  if (markGeos.length) {
    const merged = mergeGeometries(markGeos, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, laneMarkingMaterial());
      mesh.name = "roads-markings";
      group.add(mesh);
    }
    for (const g of markGeos) g.dispose();
  }

  return { group, count: doc.roads.length };
}
