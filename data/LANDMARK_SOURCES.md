# Landmark source manifest

This project adds hand-built, recognizable landmark models on top of the generic
city. This file records the external references that informed each landmark, their
creators/licences, and exactly how the geometry in this repo was produced.

## Licensing approach (important)

**No third-party 3D asset is copied into or shipped by this repository.** Every
landmark here is **original geometry recreated from scratch** with Three.js
primitives, using the references below only as *visual/proportional guides* and
using **real OpenStreetMap / City of Toronto 3D Massing coordinates and footprints**
for placement and scale.

Why recreated rather than converted/imported:

- The linked Sketchfab / CGTrader / TerraPrinter models require account login (and,
  for some, purchase) to download, and carry per-asset licences (CC-BY attribution,
  CGTrader Royalty-Free, or proprietary 3D-print STL). None are freely redistributable
  as repo assets without accepting those terms.
- The task explicitly says to "treat the linked models as geometry references, not
  permission to copy restricted assets," and to "recreate simplified landmark geometry"
  when downloads are not available/permitted. That is the path taken here.

If you later obtain a model under a licence that permits redistribution, convert it to
optimized GLB (Draco/meshopt), drop it in `public/models/`, and load it from the
matching landmark factory in `src/landmarks/` — the registry is built to swap a
primitive factory for a GLB loader without touching placement/collision.

## Geometry budget

Target was ~5K–20K triangles per landmark; the recreated models are intentionally
lighter (more than enough to be recognizable, cheaper to render):

| Landmark | Triangles | Meshes | Notes |
| --- | --- | --- | --- |
| CN Tower | ~550 | 11 | tapered hex shaft, 3 legs, main pod, SkyPod, antenna (~553 m) |
| Rogers Centre | ~2,000 | 9 | elliptical bowl + segmented low-profile dome, from real footprint |

## References

### Priority 1 — inside the current map bounds ✅ (implemented)

| # | Landmark | Reference | Creator / provider | Licence | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | CN Tower | https://sketchfab.com/3d-models/cn-tower-532b6478637c4f6894d9070719a45aaa | See Sketchfab page | Per Sketchfab page (typically CC-BY — attribution) | **Recreated** (primitives). Placed at OSM way/32742038 (lat 43.64257, lon -79.38712), aligned to 3D Massing building `tor3dm-00218`. |
| 3 | CN Tower surroundings (scan) | https://sketchfab.com/3d-models/cn-tower-scan-toronto-1f105541bda242bcb8c00ac9a71bdfd9 | See Sketchfab page | Per Sketchfab page | Used only as a context reference for the surrounding massing (already covered by the 3D Massing data). |
| 2 | Rogers Centre | https://terraprinter.com/landmarks/rogers-centre/ | TerraPrinter | Proprietary (3D-print STL product) | **Recreated** (primitives). Placed/scaled from 3D Massing building `tor3dm-00216` real footprint (~259×245 m, SW of the CN Tower). |

### Priority 2 — downtown expansion ⛔ (outside current 700 m bounds — not added)

Per "do not add landmarks outside the current map bounds," these are **not placed**.
Local coordinates below are relative to the current area centre (43.6440, -79.3888);
all fall well outside the ±350 m box. They can be enabled after expanding the map
east/north (enlarge `AREA_SIZE_M` / recentre in `scripts/config.py`, re-run the pipeline).

| # | Landmark | Reference | Approx. local (x,z) m | In bounds? |
| --- | --- | --- | --- | --- |
| 4 | Toronto City Hall | https://terraprinter.com/landmarks/toronto-city-hall/ | (395, -1058) | No (north) |
| 5 | Scotia Plaza | https://www.cgtrader.com/free-3d-models/exterior/skyscraper/scotia-plaza | (717, -523) | No (NE) |
| 6 | Commerce Court West | https://www.cgtrader.com/free-3d-models/exterior/office/commerce-court-west | (733, -434) | No (NE) |
| 7 | Gooderham Building | https://terraprinter.com/landmarks/gooderham-building/ | (1322, -706) | No (NE) |

### Priority 3 — future expansion ⛔ (far outside bounds)

| # | Landmark | Reference | Approx. local (x,z) m | In bounds? |
| --- | --- | --- | --- | --- |
| 8 | Casa Loma | https://terraprinter.com/landmarks/casa-loma/ | (-1659, -3785) | No (far north) |

### Also referenced

- Union Station (OSM, lat 43.64533, lon -79.38056) — ~310 m east of the current clip;
  model is implemented in `src/landmarks/unionStation.ts` but registered `enabled: false`.
- TerraPrinter (https://terraprinter.com/) — general landmark model/map source.

## Base map data

See `data/ATTRIBUTION.md` — buildings from the City of Toronto 3D Massing (Open
Government Licence – Toronto) and roads from OpenStreetMap (ODbL).
