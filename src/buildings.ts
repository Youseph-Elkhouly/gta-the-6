import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildingFeature, BuildingsDoc } from "./types";
import { CollisionGrid, type PolyCollider } from "./collision";
import { createFacadeMaterial } from "./materials/facade";

// Per-chunk record so we can map a raycast hit (chunk mesh + triangle index)
// back to the exact source building and its metadata.
interface ChunkMeshData {
  ids: string[]; // building id per source geometry, in merge order
  triPrefix: number[]; // cumulative triangle count; triPrefix[i] = first tri of building i
}

export interface BuildingWorld {
  group: THREE.Group;
  grid: CollisionGrid;
  meta: Map<string, BuildingFeature>;
  count: number; // generic buildings actually rendered (excludes suppressed)
  suppressedCount: number;
  pickTriangle: (mesh: THREE.Mesh, faceIndex: number) => string | null;
}

// Build one extruded geometry for a single footprint ring.
// Footprint coords are (x=east, z=south). We map the ring into a THREE.Shape as
// (x, -z) and extrude upward so the solid sits on the XZ plane from y=0..height.
function extrudeRing(ring: number[], height: number): THREE.BufferGeometry | null {
  const n = ring.length / 2;
  if (n < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(ring[0], -ring[1]);
  for (let i = 1; i < n; i++) {
    shape.lineTo(ring[i * 2], -ring[i * 2 + 1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  // Extrusion runs along +Z; rotate so it stands up along +Y (and undo the z-flip).
  geo.rotateX(-Math.PI / 2);
  // We need a non-indexed geometry so raycast faceIndex maps to a triangle range
  // per building. ExtrudeGeometry is already non-indexed; guard to avoid warnings.
  return geo.index ? geo.toNonIndexed() : geo;
}

// Optional predicate: return true for a generic building that is replaced by a
// landmark override, so both its mesh and its collider are skipped (no overlap).
export type SuppressFn = (centroidX: number, centroidZ: number, id: string) => boolean;

function buildingCentroid(b: BuildingFeature): { x: number; z: number } {
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (const ring of b.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      cx += ring[i];
      cz += ring[i + 1];
      n++;
    }
  }
  return n ? { x: cx / n, z: cz / n } : { x: 0, z: 0 };
}

export function buildBuildings(doc: BuildingsDoc, envMap: THREE.Texture, suppress?: SuppressFn): BuildingWorld {
  const group = new THREE.Group();
  group.name = "buildings";
  const grid = new CollisionGrid(24);
  const meta = new Map<string, BuildingFeature>();
  const buildingMaterial = createFacadeMaterial(envMap);
  let suppressed = 0;

  // Bucket source geometries by chunk so each chunk becomes one merged mesh.
  const byChunk = new Map<string, { geos: THREE.BufferGeometry[]; data: ChunkMeshData }>();

  for (const b of doc.buildings) {
    meta.set(b.id, b);

    // Skip generic buildings replaced by a landmark override (mesh + collider).
    if (suppress) {
      const c = buildingCentroid(b);
      if (suppress(c.x, c.z, b.id)) {
        suppressed++;
        continue;
      }
    }

    const chunkKey = `${b.chunk[0]}|${b.chunk[1]}`;
    let bucket = byChunk.get(chunkKey);
    if (!bucket) {
      bucket = { geos: [], data: { ids: [], triPrefix: [] } };
      byChunk.set(chunkKey, bucket);
    }

    // One random seed per building drives per-building shader variation.
    const seed = Math.random();

    for (const ring of b.rings) {
      // Collision footprint (strip a trailing closing dupe if present).
      addCollider(grid, b.id, ring);

      const geo = extrudeRing(ring, b.h);
      if (!geo) continue;

      // Per-vertex attributes for the facade shader (seed + building height).
      const vcount = geo.attributes.position.count;
      const seeds = new Float32Array(vcount);
      const heights = new Float32Array(vcount);
      seeds.fill(seed);
      heights.fill(b.h);
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      geo.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));

      const tris = geo.attributes.position.count / 3;
      // running triangle offset within this chunk
      const prevTris = bucket.data.triPrefix.length
        ? bucket.data.triPrefix[bucket.data.triPrefix.length - 1] + lastTriCount(bucket)
        : 0;
      bucket.data.triPrefix.push(prevTris);
      bucket.data.ids.push(b.id);
      (geo as any).__tris = tris; // stash for lastTriCount
      bucket.geos.push(geo);
    }
  }

  for (const [key, bucket] of byChunk) {
    if (bucket.geos.length === 0) continue;
    const merged = mergeGeometries(bucket.geos, false);
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, buildingMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `chunk-${key}`;
    mesh.userData.chunkData = bucket.data;
    group.add(mesh);
    // Dispose source geometries (data copied into the merged buffer).
    for (const g of bucket.geos) g.dispose();
  }

  const pickTriangle = (mesh: THREE.Mesh, faceIndex: number): string | null => {
    const data = mesh.userData.chunkData as ChunkMeshData | undefined;
    if (!data) return null;
    // faceIndex is a triangle index into the merged non-indexed geometry.
    // Find the last building whose starting triangle <= faceIndex.
    const p = data.triPrefix;
    let lo = 0;
    let hi = p.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (p[mid] <= faceIndex) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return data.ids[ans] ?? null;
  };

  return {
    group,
    grid,
    meta,
    count: doc.buildings.length - suppressed,
    suppressedCount: suppressed,
    pickTriangle,
  };
}

function lastTriCount(bucket: { geos: THREE.BufferGeometry[] }): number {
  const g = bucket.geos[bucket.geos.length - 1] as any;
  return g ? g.__tris ?? 0 : 0;
}

function addCollider(grid: CollisionGrid, id: string, ring: number[]): void {
  let n = ring.length / 2;
  // Drop closing duplicate vertex if present.
  if (n >= 2 && ring[0] === ring[(n - 1) * 2] && ring[1] === ring[(n - 1) * 2 + 1]) {
    n -= 1;
  }
  if (n < 3) return;
  const pts = new Float32Array(n * 2);
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = ring[i * 2];
    const z = ring[i * 2 + 1];
    pts[i * 2] = x;
    pts[i * 2 + 1] = z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const c: PolyCollider = { id, pts, minX, minZ, maxX, maxZ };
  grid.add(c);
}
