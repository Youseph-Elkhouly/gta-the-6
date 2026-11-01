import * as THREE from "three";
import type { PolyCollider } from "../collision";
import type { BuildingFeature } from "../types";

// A landmark override: a hand-built, recognizable model that replaces the generic
// extrusion(s) of a real-world structure. Defined in geographic coordinates so it
// aligns with the city regardless of the area centre, with explicit suppression
// so the generic building(s) underneath are removed (no overlapping geometry).

export interface SuppressShape {
  // Local-space footprint used to (a) remove generic buildings whose centroid
  // falls inside and (b) document the source footprint in debug mode.
  kind: "circle" | "ellipse";
  r?: number; // circle radius (m)
  rx?: number; // ellipse radius along x (m)
  rz?: number; // ellipse radius along z (m)
}

export interface LandmarkBuildResult {
  object: THREE.Group; // the visual model, already positioned in world space
  colliders: PolyCollider[]; // footprint collision polygons (world/local XZ)
  bounds: THREE.Box3; // world-space bounds of the model
  footprintOutline: number[]; // closed [x,z,...] outline for debug overlay
}

export interface LandmarkContext {
  originX: number; // local-space model origin (from source footprint or geo)
  originZ: number;
  source?: BuildingFeature; // the matched generic building, when known
}

export interface Landmark {
  id: string;
  name: string;
  osmId?: string; // e.g. "way/32742038"
  sourceId?: string; // matched Toronto 3D Massing building id, when known
  lat: number;
  lon: number;
  enabled: boolean; // false => in registry but not instantiated (e.g. out of area)
  heightM: number;
  metadata: Record<string, string | number>;
  suppress: SuppressShape;
  suppressIds?: string[]; // extra generic building ids to always remove
  build: (ctx: LandmarkContext) => LandmarkBuildResult;
}
