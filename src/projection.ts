// Geographic (WGS84) -> local Three.js metres, mirroring scripts/config.py so
// landmarks can be defined in real lat/lon and placed in the exact same frame as
// the generated city. Equirectangular tangent plane; +x east, +z south, origin
// at the area centre (sub-metre accurate over the playable area).

const EARTH_R = 6378137.0;

export type Projector = (lat: number, lon: number) => { x: number; z: number };

export function makeProjector(centerLat: number, centerLon: number): Projector {
  const mPerDegLat = (Math.PI / 180) * EARTH_R;
  const mPerDegLon = (Math.PI / 180) * EARTH_R * Math.cos((centerLat * Math.PI) / 180);
  return (lat: number, lon: number) => ({
    x: (lon - centerLon) * mPerDegLon,
    z: -(lat - centerLat) * mPerDegLat,
  });
}

export type InverseProjector = (x: number, z: number) => { lat: number; lon: number };

export function makeInverseProjector(centerLat: number, centerLon: number): InverseProjector {
  const mPerDegLat = (Math.PI / 180) * EARTH_R;
  const mPerDegLon = (Math.PI / 180) * EARTH_R * Math.cos((centerLat * Math.PI) / 180);
  return (x: number, z: number) => ({
    lat: centerLat - z / mPerDegLat,
    lon: centerLon + x / mPerDegLon,
  });
}
