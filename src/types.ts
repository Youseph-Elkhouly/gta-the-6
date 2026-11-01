// Shared data contracts between the Python pipeline output and the renderer.
// All coordinates are LOCAL METRES: +x east, +z south, origin at the area centre.

export interface Manifest {
  generated: boolean;
  area: {
    centerLat: number;
    centerLon: number;
    sizeM: number;
    boundsLocal: [number, number, number, number]; // minX, minZ, maxX, maxZ
    boundsLonLat: [number, number, number, number];
  };
  spawn: { x: number; z: number };
  chunkSizeM: number;
  counts: { buildings: number; roads: number };
  attribution: string[];
  crs: string;
}

export interface BuildingFeature {
  id: string;
  h: number; // height (metres)
  b: number; // base / surface elevation MSL (metres) — metadata only in v1
  hs: string; // height source
  bs: string; // building source
  chunk: [number, number];
  rings: number[][]; // each ring = flat [x,z,x,z,...] outer footprint
}

export interface BuildingsDoc {
  meta: Record<string, string>;
  buildings: BuildingFeature[];
}

export interface RoadFeature {
  id: string;
  cls: string;
  width: number;
  name: string;
  chunk: [number, number];
  pts: number[]; // flat [x,z,x,z,...] centre-line
}

export interface RoadsDoc {
  meta: Record<string, string>;
  roads: RoadFeature[];
}
