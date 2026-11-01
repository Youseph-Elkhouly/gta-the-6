#!/usr/bin/env python3
"""Fetch OSM building footprints + tags for the playable area (cached)."""
import os, sys, time, urllib.request, urllib.parse, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
OUT = os.path.join(RAW, "osm_buildings_raw.json")

def main():
    if os.path.exists(OUT) and os.path.getsize(OUT) > 1000 and "--force" not in sys.argv:
        print("[osm-bldg] cached:", OUT, os.path.getsize(OUT), "bytes"); return
    min_lon, min_lat, max_lon, max_lat = config.area_bounds_lonlat(config.FETCH_MARGIN_M)
    bbox = f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}"
    q = f"[out:json][timeout:120];(way({bbox})[\"building\"];relation({bbox})[\"building\"];);out tags center;"
    data = urllib.parse.urlencode({"data": q}).encode()
    for i, ep in enumerate(config.OVERPASS_ENDPOINTS):
        try:
            print("[osm-bldg] fetch via", ep)
            req = urllib.request.Request(ep, data=data, headers={"User-Agent": config.HTTP_USER_AGENT})
            payload = urllib.request.urlopen(req, timeout=180).read()
            if b'"elements"' not in payload:
                raise ValueError("no elements: " + payload[:120].decode("utf-8","replace"))
            open(OUT, "wb").write(payload)
            print("[osm-bldg] saved", len(payload), "bytes ->", OUT); return
        except Exception as e:
            print("[osm-bldg]   failed:", e); time.sleep(2*(i+1))
    print("[osm-bldg] ERROR: all endpoints failed; categorization will fall back to height heuristics.")

if __name__ == "__main__":
    main()
