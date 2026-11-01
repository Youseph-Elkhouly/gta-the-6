import * as THREE from "three";
import type { Manifest, BuildingsDoc, BuildingFeature } from "../types";
import type { PolyCollider } from "../collision";
import { makeProjector } from "../projection";
import type { Landmark, SuppressShape } from "./types";
import { buildCNTower } from "./cnTower";
import { buildRogersCentre } from "./rogersCentre";
import { buildUnionStation } from "./unionStation";

// ---- the registry ----
export const LANDMARKS: Landmark[] = [
  {
    id: "cn-tower",
    name: "CN Tower",
    osmId: "way/32742038",
    sourceId: "tor3dm-00218",
    lat: 43.64257,
    lon: -79.38712,
    enabled: true,
    heightM: 553,
    metadata: { completed: 1976, use: "Observation / telecom tower" },
    suppress: { kind: "circle", r: 55 },
    suppressIds: ["tor3dm-00218", "tor3dm-00217"],
    build: buildCNTower,
  },
  {
    id: "rogers-centre",
    name: "Rogers Centre",
    sourceId: "tor3dm-00216",
    lat: 43.6414,
    lon: -79.3894,
    enabled: true,
    heightM: 86,
    metadata: { completed: 1989, use: "Stadium (retractable roof)" },
    suppress: { kind: "ellipse", rx: 135, rz: 130 },
    suppressIds: ["tor3dm-00216"],
    build: buildRogersCentre,
  },
  {
    id: "union-station",
    name: "Union Station",
    osmId: "way/present-but-east-of-current-clip",
    lat: 43.64533,
    lon: -79.38056,
    // Union Station sits ~310 m east of the current 700 m playable area, so it is
    // registered + model-complete but not instantiated until the map is expanded
    // east (enlarge scripts/config.py AREA_SIZE_M / recentre, then re-run the data
    // pipeline). Flip this to true once it is inside the clip.
    enabled: false,
    heightM: 45,
    metadata: { completed: 1927, use: "Railway station (Beaux-Arts)" },
    suppress: { kind: "circle", r: 120 },
    build: buildUnionStation,
  },
];

export interface LandmarkDebugEntry {
  name: string;
  originX: number;
  originZ: number;
  outline: number[];
  bounds: THREE.Box3;
  heightM: number;
  metadata: Record<string, string | number>;
}

export interface LandmarkWorld {
  group: THREE.Group;
  colliders: PolyCollider[];
  suppress: (cx: number, cz: number, id: string) => boolean;
  entries: LandmarkDebugEntry[];
  teleport: { pos: [number, number, number]; yaw: number; pitch: number } | null;
}

function centroidOf(b: BuildingFeature): { x: number; z: number } {
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

function insideShape(dx: number, dz: number, s: SuppressShape): boolean {
  if (s.kind === "circle") return dx * dx + dz * dz <= (s.r ?? 0) * (s.r ?? 0);
  const rx = s.rx ?? 1;
  const rz = s.rz ?? 1;
  return (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz) <= 1;
}

function computeLook(
  pos: [number, number, number],
  target: [number, number, number],
): { yaw: number; pitch: number } {
  const fx = target[0] - pos[0];
  const fy = target[1] - pos[1];
  const fz = target[2] - pos[2];
  const len = Math.hypot(fx, fy, fz) || 1;
  const ny = fy / len;
  const pitch = Math.asin(Math.max(-1, Math.min(1, ny)));
  const yaw = Math.atan2(-fx / len, -fz / len);
  return { yaw, pitch };
}

export function buildLandmarks(manifest: Manifest, buildings: BuildingsDoc): LandmarkWorld {
  const proj = makeProjector(manifest.area.centerLat, manifest.area.centerLon);
  const byId = new Map(buildings.buildings.map((b) => [b.id, b]));

  const group = new THREE.Group();
  group.name = "landmarks";
  const colliders: PolyCollider[] = [];
  const entries: LandmarkDebugEntry[] = [];

  // Resolved origin + suppress-centre per active landmark.
  const active: { lm: Landmark; originX: number; originZ: number }[] = [];
  const originByLandmark = new Map<string, { x: number; z: number }>();

  for (const lm of LANDMARKS) {
    if (!lm.enabled) continue;
    const source = lm.sourceId ? byId.get(lm.sourceId) : undefined;
    const origin = source ? centroidOf(source) : proj(lm.lat, lm.lon);
    originByLandmark.set(lm.id, origin);

    const result = lm.build({ originX: origin.x, originZ: origin.z, source });
    group.add(result.object);
    for (const c of result.colliders) colliders.push(c);
    entries.push({
      name: lm.name,
      originX: origin.x,
      originZ: origin.z,
      outline: result.footprintOutline,
      bounds: result.bounds,
      heightM: lm.heightM,
      metadata: lm.metadata,
    });
    active.push({ lm, originX: origin.x, originZ: origin.z });
  }

  const suppress = (cx: number, cz: number, id: string): boolean => {
    for (const { lm, originX, originZ } of active) {
      if (lm.suppressIds && lm.suppressIds.includes(id)) return true;
      if (insideShape(cx - originX, cz - originZ, lm.suppress)) return true;
    }
    return false;
  };

  // Teleport vantage framing the CN Tower + Rogers Centre together.
  let teleport: LandmarkWorld["teleport"] = null;
  const cn = originByLandmark.get("cn-tower");
  const rg = originByLandmark.get("rogers-centre");
  if (cn && rg) {
    const mx = (cn.x + rg.x) / 2;
    const mz = (cn.z + rg.z) / 2;
    const pos: [number, number, number] = [mx + 230, 300, mz + 380];
    const { yaw, pitch } = computeLook(pos, [mx, 150, mz]);
    teleport = { pos, yaw, pitch };
  }

  return { group, colliders, suppress, entries, teleport };
}
