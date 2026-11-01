# Graph Report - gta-the-6  (2026-11-01)

## Corpus Check
- 47 files · ~287,888 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 319 nodes · 511 edges · 20 communities (18 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47ef7e47`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.ts
- index.ts
- GTA: THE 6 — Phase 1: Toronto 3D World
- scripts
- buildings.ts
- roads.ts
- process_data.py
- compilerOptions
- manifest.json
- config.py
- StreetViewPanel
- Graphics
- LandmarkDebug
- verify_aerial.mjs
- verify_browser.mjs
- verify_walk.mjs
- GTA: THE 6 — Agent Handoff

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `Input` - 12 edges
3. `main()` - 11 edges
4. `scripts` - 10 edges
5. `CollisionGrid` - 10 edges
6. `GTA: THE 6 — Phase 1: Toronto 3D World` - 10 edges
7. `process_buildings()` - 9 edges
8. `buildRoads()` - 9 edges
9. `BuildingFeature` - 9 edges
10. `buildBuildings()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `BuildingWorld` --references--> `CollisionGrid`  [EXTRACTED]
  src/buildings.ts → src/collision.ts
- `main()` --calls--> `buildBuildings()`  [EXTRACTED]
  src/main.ts → src/buildings.ts
- `LandmarkWorld` --references--> `PolyCollider`  [EXTRACTED]
  src/landmarks/index.ts → src/collision.ts
- `main()` --calls--> `buildEnvironment()`  [EXTRACTED]
  src/main.ts → src/environment.ts
- `main()` --calls--> `buildLandmarks()`  [EXTRACTED]
  src/main.ts → src/landmarks/index.ts

## Import Cycles
- None detected.

## Communities (20 total, 2 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.09
Nodes (9): loadWorldData(), CollisionGrid, resolveCirclePolygon(), FlyCamera, Hud, Input, CameraMode, main() (+1 more)

### Community 1 - "index.ts"
Cohesion: 0.16
Nodes (25): PolyCollider, buildCNTower(), cyl(), buildLandmarks(), centroidOf(), computeLook(), insideShape(), LANDMARKS (+17 more)

### Community 2 - "GTA: THE 6 — Phase 1: Toronto 3D World"
Cohesion: 0.06
Nodes (28): Buildings — City of Toronto 3D Massing, Data sources & attribution, PBR surface textures — ambientCG, Playable area, Roads — OpenStreetMap, Also referenced, Base map data, Geometry budget (+20 more)

### Community 3 - "scripts"
Cohesion: 0.07
Nodes (27): dependencies, three, description, devDependencies, puppeteer-core, @types/three, typescript, vite (+19 more)

### Community 4 - "buildings.ts"
Cohesion: 0.15
Nodes (16): WorldData, addCollider(), buildBuildings(), buildingCentroid(), BuildingWorld, ChunkMeshData, extrudeRing(), lastTriCount() (+8 more)

### Community 5 - "roads.ts"
Cohesion: 0.14
Nodes (21): buildEnvironment(), EnvRig, asphaltMaterial(), buildRoads(), laneMarkingMaterial(), PATH_CLASSES, pathMaterial(), ribbon() (+13 more)

### Community 6 - "process_data.py"
Cohesion: 0.14
Nodes (17): categorize(), Architectural categorization for Toronto buildings.  Combines OSM building tags, Return a category CODE from OSM tags + height (m) + footprint area (m^2)., chunk_of(), _find_shp(), _in_box(), load_osm_index(), main() (+9 more)

### Community 7 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, lib (+12 more)

### Community 8 - "manifest.json"
Cohesion: 0.10
Nodes (19): area, boundsLocal, boundsLonLat, centerLat, centerLon, sizeM, attribution, chunkSizeM (+11 more)

### Community 9 - "config.py"
Cohesion: 0.14
Nodes (15): area_bounds_local(), area_bounds_lonlat(), lonlat_to_local(), Shared configuration for the GTA: THE 6 Toronto data pipeline.  All geographic c, WGS84 lon/lat (degrees) -> local (x_east, z_south) metres.      Returns (x, z) w, EPSG:3857 (Web Mercator metres) -> WGS84 lon/lat degrees.      The City of Toron, Return (min_lon, min_lat, max_lon, max_lat) for the clip box.      `margin_m` ex, Return clip box in local metres as (min_x, min_z, max_x, max_z). (+7 more)

### Community 10 - "StreetViewPanel"
Cohesion: 0.38
Nodes (4): InverseProjector, makeInverseProjector(), Projector, StreetViewPanel

### Community 11 - "Graphics"
Cohesion: 0.31
Nodes (3): Graphics, Quality, QUALITY_CYCLE

### Community 12 - "LandmarkDebug"
Cohesion: 0.32
Nodes (3): LandmarkDebug, LandmarkDebugEntry, LandmarkWorld

### Community 13 - "verify_aerial.mjs"
Cohesion: 0.40
Nodes (4): CAM, errors, PITCH, YAW

### Community 19 - "GTA: THE 6 — Agent Handoff"
Cohesion: 0.18
Nodes (10): Commands, Contribution guidance, Current checkout state (2026-11-01), Data and asset licenses, Data pipeline, GTA: THE 6 — Agent Handoff, Outstanding work / known blockers, Project goal (+2 more)

## Knowledge Gaps
- **99 isolated node(s):** `name`, `private`, `version`, `type`, `description` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CollisionGrid` connect `main.ts` to `index.ts`, `buildings.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _99 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08502024291497975 - nodes in this community are weakly interconnected._
- **Should `GTA: THE 6 — Phase 1: Toronto 3D World` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `buildings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1455026455026455 - nodes in this community are weakly interconnected._
- **Should `roads.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._