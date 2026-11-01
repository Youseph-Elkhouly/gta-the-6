# GTA: THE 6 — Agent Handoff

This document is the working brief for an agent opening this repository without
the earlier conversation. Read it together with `README.md` and
`data/ATTRIBUTION.md` before changing the project.

## Project goal

Build an explorable, geographically accurate browser model of downtown Toronto
around the CN Tower. The current milestone is a Three.js world with Toronto
building footprints/heights, OSM roads, hand-built landmark models, a walkable
third-person player, collision, and a free-fly camera. This is not yet a GTA-style
game: there are no NPCs, vehicles, missions, or gameplay systems.

The playable box is about 700 × 700 m, centred at 43.6440, -79.3888, covering the
CN Tower, Rogers Centre, and nearby downtown blocks.

## Start here

From this directory:

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173/`). The dev server is
not currently running. `node_modules/` is present in this checkout.

Controls: WASD move, mouse look, Shift sprint, Space jump, C/F switch to free-fly,
Q descend in free-fly, G cycle graphics quality, L toggle landmark debug, T frame
the CN Tower and Rogers Centre, V toggle the Street View comparison, Escape release
the pointer, and click buildings to inspect them.

## Tech and key entry points

- Vite + TypeScript + Three.js (`three` 0.169.x); no app framework.
- `index.html` contains the app shell, HUD, inspector, controls and overlay styles.
- `src/main.ts` is the bootstrap and render loop. It loads data, builds lighting,
  landmarks, buildings, roads, water and post-processing, then updates player/fly
  camera, HUD and rendering.
- `src/assets.ts` loads `public/data/manifest.json`, `buildings.json` and
  `roads.json`. `src/types.ts` defines the shared data contracts.
- `src/environment.ts`, `src/sky.ts`, `src/water.ts` and
  `src/postprocessing.ts` build environment, water and graphics effects.
- `src/buildings.ts` extrudes footprint rings, buckets/merges meshes by spatial
  chunk, creates collision footprints, and maps raycast triangles back to source
  building IDs. `src/collision.ts` handles the independent 2D collision grid.
- `src/materials/facade.ts` supplies the shared category-aware facade shader.
  `src/textures.ts` loads tiled local textures; `src/roads.ts` builds road/path
  ribbons and markings.
- `src/landmarks/index.ts` is the landmark override registry. Individual models
  live in `src/landmarks/`; overrides suppress matching generic buildings and
  install their own collision geometry.
- `src/inspector.ts` shows selected building metadata.
  `src/streetView.ts` converts the current local position back to WGS84 and
  presents a no-key Google Street View viewer/link for comparison.
- `src/player.ts`, `src/flyCamera.ts`, `src/input.ts` and `src/hud.ts` implement
  movement, camera, controls and debug display.

### Data pipeline

- `scripts/config.py` is the source of truth for map bounds, coordinates,
  projection, download endpoints and player spawn.
- `scripts/download_data.py` downloads/caches the Toronto 3D Massing shapefile and
  OSM roads.
- `scripts/fetch_osm_buildings.py` separately fetches OSM building tags.
- `scripts/categorize.py` maps OSM tags plus height/area to the facade category
  codes. Category codes must stay aligned with `src/materials/facade.ts`.
- `scripts/process_data.py` clips/reprojects the source geometry, enriches it
  with nearby OSM tags when a cache exists, and writes the compact browser files
  under `public/data/`.
- `scripts/requirements.txt` only requires pyshp. A local `.venv` exists in this
  workspace and has pyshp; the system `python3` previously did not. For local data
  processing, use the active project venv or `.venv/bin/python` directly.

Data flow: City shapefile/Web Mercator + OSM JSON/WGS84 → local metre coordinates
→ compact JSON → browser-side Three.js extrusion/ribbons. The local frame is
`+x=east`, `+z=south`, origin at the configured area centre. The current spawn is
on the Bremner Boulevard sidewalk southeast of the CN Tower, looking northeast
along the street. Heights are metres;
the renderer uses Three.js Y as up. The projection helpers in
`scripts/config.py` and `src/projection.ts` must remain inverse-compatible.

## Current checkout state (2026-11-01)

The repository has uncommitted graphics-upgrade work. Preserve it and inspect the
working tree before editing; do not reset or overwrite these changes.

- Added inverse projection and `StreetViewPanel` (`V` key); Google viewer is a
  public no-key consumer URL. No paid API or API key is used by this project.
- Added architectural categories, OSM match/name fields, inspector fields, and
  `public/data/sources.json` provenance output.
- Added local CC0 ambientCG asphalt, concrete and brick image maps in
  `public/textures/`; see `data/ATTRIBUTION.md`.
- Road ribbons now use upward-facing triangle winding (the old winding was
  back-face culled), visible dashed center markings, and concrete sidewalk bands.
  Spawn is on Bremner Boulevard, aimed northeast along the road.
- Lake water now uses smaller, lower-amplitude normals and reduced reflection
  glare; the water shader scale must be set through its `size` uniform because
  `Water.js` samples the normal map using world coordinates.
- Regenerated the building dataset: 291 buildings, currently 0 OSM matches.
  Category counts in the generated data are 102 glass towers, 90 office mid-rises,
  64 masonry low-rises and 35 houses. These are currently height/area fallbacks.
- The roads data has 524 ways. `public/data/manifest.json` reflects 291 buildings
  and 524 roads.
- `graphify-out/` was created/updated. It is a code navigation graph, not runtime
  app data. Per repository instructions, use `graphify query "..."` for codebase
  questions when `graphify-out/graph.json` exists, and run `graphify update .`
  after source edits.
- `npm run typecheck` passes after the road/spawn changes. A production build and
  browser verification have not been run. Available commands are listed below.

### Outstanding work / known blockers

1. **OSM building enrichment:** `data/raw/osm_buildings_raw.json` is absent. The
   regular sandbox fetch failed on DNS; the network-enabled retry timed out on
   Overpass. The fetch script is in place. If network access is available, run
   `python scripts/fetch_osm_buildings.py`, then regenerate via
   `python scripts/process_data.py` (with the project venv active). It is okay for
   the pipeline to fall back to height/area categories when the public endpoint is
   unavailable. Do not introduce a paid API for this.
2. **Toronto MultiPatch geometry:** the 2025 MultiPatch archive has been downloaded
   to `data/raw/3dmassingmultipatch_2025.zip`; it contains an Esri File Geodatabase.
   It has not been converted or rendered. No GDAL/OGR reader was available. A
   Homebrew GDAL install was attempted but stopped because dependency extraction
   exhausted free disk space; temporary install files were removed, restoring
   about 2.5 GB at that point. Check current free space before any install retry.
   Do not claim that true MultiPatch geometry is in the app yet.
3. **Runtime/browser verification:** run `npm run typecheck`, `npm run build`,
   `npm run verify` and/or `npm run verify:functional` when verification is
   requested/appropriate. The browser smoke test needs Chrome via puppeteer-core.

The project explicitly avoids paid APIs. Keep Street View no-key/link-based and
use local/free data or assets unless the user changes that requirement.

## Commands

```sh
npm run dev                 # local Vite server
npm run typecheck           # TypeScript check
npm run build               # tsc + Vite production build
npm run data:download       # cached Toronto buildings + OSM roads
npm run data:process        # regenerate public/data JSON (Python + pyshp)
npm run verify              # browser smoke test; Chrome required
npm run verify:functional   # collision and building-pick checks
graphify update .           # refresh code graph after source changes
```

The npm data scripts call `python3`. If that interpreter does not have pyshp,
activate `.venv` first or invoke the scripts with `.venv/bin/python` directly.
Raw downloads under `data/raw/` are git-ignored; the small generated app data under
`public/data/` is intentionally checked in.

## Data and asset licenses

- Building source geometry: City of Toronto 3D Massing, Open Government Licence –
  Toronto. Keep attribution in `data/ATTRIBUTION.md` and generated provenance.
- Roads and OSM tags: © OpenStreetMap contributors, ODbL. Keep OSM attribution and
  provenance when distributing derivatives.
- Surface maps: ambientCG Asphalt016, Concrete034 and Bricks075A, CC0 1.0.
- Hand-built landmark source references and model attributions are recorded in
  `data/LANDMARK_SOURCES.md`.

## Contribution guidance

- Read `README.md`, `data/ATTRIBUTION.md`, and this file before changing data or
  renderer behavior.
- Preserve geographic consistency: update shared projection/config values in the
  Python and TypeScript helpers together.
- Keep generated geometry in local metres and the browser data engine-agnostic.
- Keep category numeric codes synchronized between Python categorization and the
  facade shader.
- Preserve landmark suppression/collider behavior when changing building meshes.
- Avoid adding API keys, paid API dependencies, or unlicensed third-party assets.
- Inspect `git status` first; the current tree includes the work listed above.
