// Lightweight 2D collision for the walking player.
//
// Buildings are treated as solid, infinitely-tall obstacles described by their
// footprint polygon(s) on the XZ ground plane. The player is a circle (the
// capsule's radius). We resolve circle-vs-polygon penetration by pushing the
// circle centre to the nearest boundary edge. A uniform spatial-hash grid keeps
// the per-frame test cheap and ready to scale to many more city chunks.

export interface PolyCollider {
  id: string;
  pts: Float32Array; // flat [x,z,x,z,...], one footprint ring (no closing dupe)
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export class CollisionGrid {
  private cell: number;
  private buckets = new Map<string, PolyCollider[]>();
  readonly colliders: PolyCollider[] = [];

  constructor(cellSize = 24) {
    this.cell = cellSize;
  }

  private key(cx: number, cz: number): string {
    return `${cx}|${cz}`;
  }

  add(c: PolyCollider): void {
    this.colliders.push(c);
    const x0 = Math.floor(c.minX / this.cell);
    const x1 = Math.floor(c.maxX / this.cell);
    const z0 = Math.floor(c.minZ / this.cell);
    const z1 = Math.floor(c.maxZ / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(c);
      }
    }
  }

  private nearby(x: number, z: number, r: number): PolyCollider[] {
    const out = new Set<PolyCollider>();
    const x0 = Math.floor((x - r) / this.cell);
    const x1 = Math.floor((x + r) / this.cell);
    const z0 = Math.floor((z - r) / this.cell);
    const z1 = Math.floor((z + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const b = this.buckets.get(this.key(cx, cz));
        if (b) for (const c of b) out.add(c);
      }
    }
    return [...out];
  }

  // Resolve the player circle against all nearby building footprints.
  // Mutates and returns the corrected position via the provided out object.
  resolve(x: number, z: number, radius: number, out: { x: number; z: number }): boolean {
    let px = x;
    let pz = z;
    let collided = false;
    // Two relaxation passes handle wedged-in-corner cases cleanly.
    for (let pass = 0; pass < 2; pass++) {
      const cands = this.nearby(px, pz, radius);
      for (const c of cands) {
        if (px + radius < c.minX || px - radius > c.maxX || pz + radius < c.minZ || pz - radius > c.maxZ) {
          continue; // broad-phase bbox reject
        }
        const res = resolveCirclePolygon(px, pz, radius, c.pts);
        if (res) {
          px = res.x;
          pz = res.z;
          collided = true;
        }
      }
    }
    out.x = px;
    out.z = pz;
    return collided;
  }
}

// Returns corrected centre if the circle overlaps the (solid) polygon, else null.
function resolveCirclePolygon(cx: number, cz: number, r: number, pts: Float32Array): { x: number; z: number } | null {
  const n = pts.length / 2;
  // Closest point on the polygon boundary + whether centre is inside.
  let bestDist2 = Infinity;
  let bx = 0;
  let bz = 0;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2];
    const zi = pts[i * 2 + 1];
    const xj = pts[j * 2];
    const zj = pts[j * 2 + 1];

    // point-in-polygon (ray cast)
    if ((zi > cz) !== (zj > cz)) {
      const t = (cz - zi) / (zj - zi);
      const xcross = xi + t * (xj - xi);
      if (cx < xcross) inside = !inside;
    }

    // closest point on segment i->j... actually edge j->i
    const ex = xi - xj;
    const ez = zi - zj;
    const len2 = ex * ex + ez * ez || 1e-9;
    let tt = ((cx - xj) * ex + (cz - zj) * ez) / len2;
    tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
    const qx = xj + tt * ex;
    const qz = zj + tt * ez;
    const dx = cx - qx;
    const dz = cz - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bx = qx;
      bz = qz;
    }
  }

  const dist = Math.sqrt(bestDist2);
  if (!inside && dist >= r) return null; // outside and far enough: no contact

  let nx = cx - bx;
  let nz = cz - bz;
  const nlen = Math.hypot(nx, nz) || 1e-9;
  nx /= nlen;
  nz /= nlen;

  if (inside) {
    // push OUT: move to the boundary point then step out by r
    return { x: bx - nx * r, z: bz - nz * r };
  }
  // outside but penetrating: push out to boundary + r along outward normal
  return { x: bx + nx * r, z: bz + nz * r };
}
