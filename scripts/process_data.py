#!/usr/bin/env python3
"""
process_data.py — turn cached raw Toronto data into compact, browser-ready assets.

Pipeline (see README):
  1. Clip source data to the 700 m playable area around the CN Tower.
  2. Reproject geometry into local Three.js metres (XZ ground plane).
  3. Emit buildings as flat footprint rings + height (runtime-extruded in-browser).
  4. Emit roads as centre-line polylines + width (runtime-ribboned in-browser).
  5. Assign every feature to a spatial chunk so the map can expand later.
  6. Preserve building height/source metadata and a stable per-building ID.

Outputs (written to public/data/, served directly by Vite):
  - buildings.json : { meta, buildings:[ {id,h,b,hs,bs,chunk,rings:[[x,z,...]]} ] }
  - roads.json     : { meta, roads:[ {id,cls,width,chunk,pts:[x,z,...]} ] }
  - manifest.json  : small index with area + chunk config + counts + attribution

The format is deliberately engine-agnostic: local metres, no Three.js types, so
the same assets can feed any renderer and new neighbourhoods just add features.
"""
from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402
import categorize as cat  # noqa: E402

try:
    import shapefile  # pyshp
except ImportError:
    print("ERROR: pyshp not installed. Run: pip install pyshp", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")
OUT_DIR = os.path.join(ROOT, "public", "data")

BUILDINGS_DIR = os.path.join(RAW_DIR, "3dmassing_2025")
ROADS_JSON = os.path.join(RAW_DIR, "osm_roads_raw.json")
OSM_BUILDINGS_JSON = os.path.join(RAW_DIR, "osm_buildings_raw.json")

# Max distance (m) to accept an OSM building centre as a match for a 3D Massing
# building centroid (tag enrichment only; geometry always comes from 3D Massing).
OSM_MATCH_RADIUS_M = 28.0

# Spatial chunk edge length in metres. 175 m => a 4x4 grid across the 700 m area.
# The browser groups geometry per chunk (fewer draw calls) and the HUD reports
# which chunk the player is in. New neighbourhoods simply extend the grid.
CHUNK_SIZE_M = 175.0

MIN_BUILDING_HEIGHT = 3.0   # floor for degenerate/zero heights (metres)
COORD_PRECISION = 2         # decimal places (centimetre precision)

# Approx carriageway width per OSM highway class (metres).
ROAD_WIDTHS = {
    "motorway": 16, "motorway_link": 8,
    "trunk": 15, "trunk_link": 8,
    "primary": 13, "primary_link": 7,
    "secondary": 11, "secondary_link": 6,
    "tertiary": 9, "tertiary_link": 6,
    "residential": 8, "unclassified": 7, "living_street": 7,
    "service": 5, "pedestrian": 6, "footway": 3, "path": 2.5,
    "cycleway": 2.5, "steps": 2, "track": 4,
}
DEFAULT_ROAD_WIDTH = 6.0
# Road classes we skip entirely (not useful ground surfaces for exploration).
SKIP_ROAD_CLASSES = {"steps", "elevator", "corridor", "proposed", "construction"}


def _round(v: float) -> float:
    return round(v, COORD_PRECISION)


def chunk_of(x: float, z: float) -> list[int]:
    return [math.floor(x / CHUNK_SIZE_M), math.floor(z / CHUNK_SIZE_M)]


def _in_box(x: float, z: float, half: float) -> bool:
    return -half <= x <= half and -half <= z <= half


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------
def _signed_area(ring: list[tuple[float, float]]) -> float:
    a = 0.0
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        a += x1 * z2 - x2 * z1
    return a * 0.5


class OSMIndex:
    """Nearest-centre lookup of OSM buildings (for tag enrichment)."""

    def __init__(self):
        self.cell = 40.0
        self.buckets: dict[tuple[int, int], list] = {}
        self.count = 0

    def _key(self, x, z):
        return (int(x // self.cell), int(z // self.cell))

    def add(self, x, z, el):
        self.buckets.setdefault(self._key(x, z), []).append((x, z, el))
        self.count += 1

    def match(self, x, z, radius):
        best = None
        best_d2 = radius * radius
        cx, cz = int(x // self.cell), int(z // self.cell)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for (bx, bz, el) in self.buckets.get((cx + dx, cz + dz), ()):
                    d2 = (bx - x) ** 2 + (bz - z) ** 2
                    if d2 <= best_d2:
                        best_d2 = d2
                        best = el
        return best


def load_osm_index() -> OSMIndex:
    idx = OSMIndex()
    if not (os.path.exists(OSM_BUILDINGS_JSON) and os.path.getsize(OSM_BUILDINGS_JSON) > 100):
        print("[osm-bldg] no OSM building cache — categorizing from height only.")
        return idx
    with open(OSM_BUILDINGS_JSON) as f:
        data = json.load(f)
    for el in data.get("elements", []):
        c = el.get("center") or ({"lat": el.get("lat"), "lon": el.get("lon")} if el.get("lat") else None)
        if not c or c.get("lat") is None:
            continue
        x, z = config.lonlat_to_local(c["lon"], c["lat"])
        idx.add(x, z, el)
    print(f"[osm-bldg] indexed {idx.count} OSM buildings for tag matching")
    return idx


def process_buildings() -> dict:
    shp_path = _find_shp(BUILDINGS_DIR)
    if not shp_path:
        print(f"ERROR: no .shp found under {BUILDINGS_DIR}. Run download_data.py first.", file=sys.stderr)
        sys.exit(1)
    print(f"[buildings] reading {shp_path}")

    min_lon, min_lat, max_lon, max_lat = config.area_bounds_lonlat(margin_m=0.0)
    half = config.AREA_SIZE_M / 2.0
    # Generous centroid pre-filter in degrees (cheap reject before vertex reprojection).
    pad = 0.0015
    reader = shapefile.Reader(shp_path)
    fields = [f[0] for f in reader.fields[1:]]
    idx = {name: i for i, name in enumerate(fields)}

    osm_index = load_osm_index()
    sources = []  # per-building provenance manifest
    matched = 0
    buildings = []
    kept = 0
    scanned = 0
    for sr in reader.iterShapeRecords():
        scanned += 1
        rec = sr.record
        # Fast reject using the stored centroid lon/lat.
        clon = rec[idx.get("LONGITUDE", -1)] if "LONGITUDE" in idx else None
        clat = rec[idx.get("LATITUDE", -1)] if "LATITUDE" in idx else None
        if clon is not None and clat is not None:
            if not (min_lon - pad <= clon <= max_lon + pad and min_lat - pad <= clat <= max_lat + pad):
                continue

        shape = sr.shape
        if not shape.points:
            continue

        # Split multipart polygon into rings of local (x,z) coords.
        parts = list(shape.parts) + [len(shape.points)]
        rings_local: list[list[tuple[float, float]]] = []
        for p in range(len(parts) - 1):
            ring_pts = shape.points[parts[p]:parts[p + 1]]
            local = []
            for (mx, my) in ring_pts:
                lon, lat = config.webmercator_to_lonlat(mx, my)
                x, z = config.lonlat_to_local(lon, lat)
                local.append((x, z))
            if len(local) >= 4:
                rings_local.append(local)
        if not rings_local:
            continue

        # Clip: keep building if any vertex of any ring falls inside the box.
        if not any(_in_box(x, z, half) for ring in rings_local for (x, z) in ring):
            continue

        # Height: prefer the largest populated height field; floor degenerate values.
        h = max(
            float(rec[idx["MAX_HEIGHT"]]) if "MAX_HEIGHT" in idx else 0.0,
            float(rec[idx["AVG_HEIGHT"]]) if "AVG_HEIGHT" in idx else 0.0,
            float(rec[idx["MIN_HEIGHT"]]) if "MIN_HEIGHT" in idx else 0.0,
        )
        if h <= 0.5:
            h = MIN_BUILDING_HEIGHT
        base = float(rec[idx["SURF_ELEV"]]) if "SURF_ELEV" in idx else 0.0

        # Emit each ring as its own outer footprint (holes ignored for massing).
        # Ensure consistent (CCW) winding so the browser extrudes a solid.
        out_rings = []
        cx = cz = 0.0
        npts = 0
        for ring in rings_local:
            # Drop a trailing duplicate closing vertex if present.
            if len(ring) >= 2 and ring[0] == ring[-1]:
                ring = ring[:-1]
            if len(ring) < 3:
                continue
            if _signed_area(ring) < 0:
                ring = ring[::-1]
            flat = []
            for (x, z) in ring:
                flat.append(_round(x))
                flat.append(_round(z))
                cx += x
                cz += z
                npts += 1
            out_rings.append(flat)
        if not out_rings or npts == 0:
            continue
        cx /= npts
        cz /= npts

        # --- OSM tag match + architectural category ---
        area = abs(_signed_area([(out_rings[0][i], out_rings[0][i + 1])
                                 for i in range(0, len(out_rings[0]), 2)]))
        osm_el = osm_index.match(cx, cz, OSM_MATCH_RADIUS_M)
        tags = (osm_el.get("tags") or {}) if osm_el else {}
        osm_id = (f"{osm_el.get('type')}/{osm_el.get('id')}" if osm_el else "")
        name = tags.get("name", "")
        levels = tags.get("building:levels", "")
        category = cat.categorize(tags, h, area)
        if osm_el:
            matched += 1

        bid = f"tor3dm-{kept:05d}"
        buildings.append({
            "id": bid,
            "h": round(h, 2),
            "b": round(base, 2),
            "hs": (rec[idx["HEIGHT_SRC"]].strip() if "HEIGHT_SRC" in idx else ""),
            "bs": (rec[idx["BLDG_SRC"]].strip() if "BLDG_SRC" in idx else ""),
            "cat": category,
            "catName": cat.category_name(category),
            "osm": osm_id,
            "name": name,
            "chunk": chunk_of(cx, cz),
            "rings": out_rings,
        })
        sources.append({
            "id": bid,
            "geometry": "City of Toronto 3D Massing 2025",
            "osm": osm_id,
            "name": name,
            "category": cat.category_name(category),
            "levels": levels,
            "tags": {k: tags[k] for k in ("building", "amenity", "shop", "office",
                     "building:material", "start_date") if k in tags},
        })
        kept += 1

    print(f"[buildings] scanned {scanned} records, kept {kept} within the area; "
          f"OSM-matched {matched}/{kept}")
    # Persist the per-building source manifest.
    with open(os.path.join(OUT_DIR, "sources.json"), "w") as f:
        json.dump({
            "note": "Per-building provenance. Geometry from City of Toronto 3D "
                    "Massing; tags/category enriched from OpenStreetMap where matched.",
            "licenses": {
                "geometry": "Open Government Licence – Toronto",
                "osm": "ODbL — © OpenStreetMap contributors",
            },
            "categories": cat.CATEGORIES,
            "buildings": sources,
        }, f, separators=(",", ":"))

    return {
        "meta": {
            "source": "City of Toronto Open Data — 3D Massing (2025 shapefile)",
            "sourceUrl": "https://open.toronto.ca/dataset/3d-massing/",
            "license": "Open Government Licence – Toronto",
            "crs": "local metres (equirectangular tangent plane)",
            "categories": cat.CATEGORIES,
        },
        "buildings": buildings,
    }


def _find_shp(root: str):
    if not os.path.isdir(root):
        return None
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.lower().endswith(".shp"):
                return os.path.join(dirpath, fn)
    return None


# ---------------------------------------------------------------------------
# Roads
# ---------------------------------------------------------------------------
def process_roads() -> dict:
    roads = []
    half = config.AREA_SIZE_M / 2.0
    if not (os.path.exists(ROADS_JSON) and os.path.getsize(ROADS_JSON) > 100):
        print("[roads] no OSM road cache found — emitting empty road set (fallback).")
        return {"meta": {"source": "none", "note": "OSM fetch unavailable"}, "roads": []}

    with open(ROADS_JSON) as f:
        data = json.load(f)
    elements = data.get("elements", [])
    kept = 0
    for el in elements:
        if el.get("type") != "way":
            continue
        tags = el.get("tags", {})
        cls = tags.get("highway", "")
        if not cls or cls in SKIP_ROAD_CLASSES:
            continue
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue

        pts_local = []
        for nd in geom:
            x, z = config.lonlat_to_local(nd["lon"], nd["lat"])
            pts_local.append((x, z))

        # Clip: keep way if any vertex is inside the box (keeps continuity at edges).
        if not any(_in_box(x, z, half) for (x, z) in pts_local):
            continue

        flat = []
        for (x, z) in pts_local:
            flat.append(_round(x))
            flat.append(_round(z))

        # chunk from midpoint
        mid = pts_local[len(pts_local) // 2]
        roads.append({
            "id": f"osm-{el.get('id')}",
            "cls": cls,
            "width": ROAD_WIDTHS.get(cls, DEFAULT_ROAD_WIDTH),
            "name": tags.get("name", ""),
            "chunk": chunk_of(mid[0], mid[1]),
            "pts": flat,
        })
        kept += 1

    print(f"[roads] kept {kept} road ways within the area")
    return {
        "meta": {
            "source": "OpenStreetMap contributors (via Overpass API)",
            "sourceUrl": "https://www.openstreetmap.org/",
            "license": "Open Database License (ODbL)",
            "crs": "local metres (equirectangular tangent plane)",
        },
        "roads": roads,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    b = process_buildings()
    r = process_roads()

    with open(os.path.join(OUT_DIR, "buildings.json"), "w") as f:
        json.dump(b, f, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "roads.json"), "w") as f:
        json.dump(r, f, separators=(",", ":"))

    # Manifest / index: everything the renderer needs to set up the world.
    min_lon, min_lat, max_lon, max_lat = config.area_bounds_lonlat(0.0)
    manifest = {
        "generated": True,
        "area": {
            "centerLat": config.AREA_CENTER_LAT,
            "centerLon": config.AREA_CENTER_LON,
            "sizeM": config.AREA_SIZE_M,
            "boundsLocal": config.area_bounds_local(),
            "boundsLonLat": [min_lon, min_lat, max_lon, max_lat],
        },
        "spawn": _spawn_local(),
        "chunkSizeM": CHUNK_SIZE_M,
        "counts": {"buildings": len(b["buildings"]), "roads": len(r["roads"])},
        "attribution": [
            "Buildings: City of Toronto Open Data — 3D Massing (Open Government Licence – Toronto)",
            "Roads: © OpenStreetMap contributors (ODbL)",
        ],
        "crs": "local metres; +x east, +z south; origin at area centre",
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    _report_sizes()
    print("[done] assets written to", OUT_DIR)


def _spawn_local() -> dict:
    """Player spawn: just south-east of the CN Tower, in the open plaza."""
    x, z = config.lonlat_to_local(config.CN_TOWER_LON, config.CN_TOWER_LAT)
    return {
        "x": round(x + config.SPAWN_OFFSET_X, 2),
        "z": round(z + config.SPAWN_OFFSET_Z, 2),
    }


def _report_sizes() -> None:
    for fn in ("buildings.json", "roads.json", "manifest.json"):
        p = os.path.join(OUT_DIR, fn)
        if os.path.exists(p):
            kb = os.path.getsize(p) / 1024
            print(f"[size] {fn}: {kb:.1f} KB")


if __name__ == "__main__":
    main()
