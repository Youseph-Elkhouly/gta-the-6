#!/usr/bin/env python3
"""
download_data.py — acquire & cache raw Toronto geospatial source data.

Sources
-------
1. Buildings  : City of Toronto Open Data "3D Massing" (2025 shapefile, EPSG:3857).
                Official municipal building footprints with per-building heights.
2. Roads      : OpenStreetMap, fetched via the Overpass API for the playable
                area's bounding box (highways only).

Everything is cached under data/raw/ so the app and the processing step never
hit an external API more than once. Re-running is idempotent: existing files
are reused unless --force is given.

Usage:
    python scripts/download_data.py            # download anything missing
    python scripts/download_data.py --force    # re-download everything
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
import urllib.error
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

RAW_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")

BUILDINGS_ZIP = os.path.join(RAW_DIR, "3dmassing_2025_wgs84.zip")
BUILDINGS_DIR = os.path.join(RAW_DIR, "3dmassing_2025")
ROADS_JSON = os.path.join(RAW_DIR, "osm_roads_raw.json")


def _get(url: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": config.HTTP_USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def download_buildings(force: bool = False) -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    if not force and os.path.exists(BUILDINGS_ZIP) and os.path.getsize(BUILDINGS_ZIP) > 1_000_000:
        print(f"[buildings] cached: {BUILDINGS_ZIP} ({os.path.getsize(BUILDINGS_ZIP)//1024//1024} MB)")
    else:
        print(f"[buildings] downloading 3D Massing shapefile (~80 MB)…")
        payload = _get(config.TORONTO_3D_MASSING_SHP_URL, timeout=600)
        with open(BUILDINGS_ZIP, "wb") as f:
            f.write(payload)
        print(f"[buildings] saved {len(payload)//1024//1024} MB -> {BUILDINGS_ZIP}")

    # Unzip (idempotent)
    if force or not os.path.exists(BUILDINGS_DIR):
        print("[buildings] extracting…")
        with zipfile.ZipFile(BUILDINGS_ZIP) as z:
            z.extractall(BUILDINGS_DIR)
    shp = _find_shp(BUILDINGS_DIR)
    print(f"[buildings] shapefile ready: {shp}")


def _find_shp(root: str) -> str | None:
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.lower().endswith(".shp"):
                return os.path.join(dirpath, fn)
    return None


def _overpass_query() -> str:
    min_lon, min_lat, max_lon, max_lat = config.area_bounds_lonlat(config.FETCH_MARGIN_M)
    # OSM / Overpass bbox order is (south, west, north, east) = (min_lat, min_lon, max_lat, max_lon)
    bbox = f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}"
    return (
        "[out:json][timeout:120];\n"
        "(\n"
        f'  way({bbox})["highway"];\n'
        ");\n"
        "out geom;\n"
    )


def download_roads(force: bool = False) -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    if not force and os.path.exists(ROADS_JSON) and os.path.getsize(ROADS_JSON) > 1000:
        print(f"[roads] cached: {ROADS_JSON} ({os.path.getsize(ROADS_JSON)} bytes)")
        return

    query = _overpass_query()
    data = urllib.parse.urlencode({"data": query}).encode()
    last_err = None
    for attempt, endpoint in enumerate(config.OVERPASS_ENDPOINTS):
        try:
            print(f"[roads] Overpass fetch via {endpoint} …")
            payload = _get(endpoint, data=data, timeout=180)
            # Validate it is JSON with elements
            text = payload.decode("utf-8", "replace")
            if '"elements"' not in text:
                raise ValueError(f"unexpected response (first 120 chars): {text[:120]!r}")
            with open(ROADS_JSON, "wb") as f:
                f.write(payload)
            print(f"[roads] saved {len(payload)} bytes -> {ROADS_JSON}")
            return
        except (urllib.error.URLError, ValueError, TimeoutError, OSError) as e:
            last_err = e
            print(f"[roads]   failed: {e}")
            time.sleep(2 * (attempt + 1))  # linear backoff
    print(f"[roads] ERROR: all Overpass endpoints failed ({last_err}).")
    print("[roads] The processing step will fall back to deriving a street grid "
          "from gaps between building footprints. See README 'Fallbacks'.")


import urllib.parse  # noqa: E402  (after functions to keep header tidy)


def main() -> None:
    ap = argparse.ArgumentParser(description="Download & cache Toronto geospatial data.")
    ap.add_argument("--force", action="store_true", help="re-download even if cached")
    ap.add_argument("--roads-only", action="store_true")
    ap.add_argument("--buildings-only", action="store_true")
    args = ap.parse_args()

    if not args.roads_only:
        download_buildings(force=args.force)
    if not args.buildings_only:
        download_roads(force=args.force)
    print("[done] raw data cached in", RAW_DIR)


if __name__ == "__main__":
    main()
