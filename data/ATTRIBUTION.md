# Data sources & attribution

This project uses real geospatial data for downtown Toronto. Raw source files are
cached under `data/raw/` (git-ignored, re-downloadable via `scripts/download_data.py`)
and processed into browser-ready assets under `public/data/`.

## Buildings — City of Toronto 3D Massing

- **Dataset:** 3D Massing, City of Toronto Open Data
- **Page:** https://open.toronto.ca/dataset/3d-massing/
- **File used:** `3DMassingShapefile_2025_WGS84.zip` (ESRI Shapefile; geometry in
  EPSG:3857 / Web Mercator despite the "WGS84" filename)
- **Fields used:** `MAX_HEIGHT` / `AVG_HEIGHT` / `MIN_HEIGHT` (building height, m),
  `SURF_ELEV` (ground elevation MSL, m), `HEIGHT_SRC`, `BLDG_SRC`, `LONGITUDE`, `LATITUDE`
- **Licence:** Open Government Licence – Toronto
  (https://open.toronto.ca/open-data-license/)
- **Attribution:** Contains information licensed under the Open Government Licence – Toronto.

## Roads — OpenStreetMap

- **Source:** OpenStreetMap, fetched via the Overpass API for the playable bounding box
- **File used:** `osm_roads_raw.json` (Overpass `out geom` for `way[highway]`)
- **Licence:** Open Database License (ODbL) — https://www.openstreetmap.org/copyright
- **Attribution:** © OpenStreetMap contributors.

## Playable area

- ~700 m × 700 m square centred near the CN Tower (lat 43.6440, lon -79.3888),
  covering the CN Tower, Rogers Centre, and part of the Entertainment District.
- World units are **metres**. Local frame: +x = east, +z = south, origin at the
  area centre. Projection is an equirectangular tangent plane (sub-metre accurate
  over <1 km), so no heavyweight GIS dependency is required at build time.
