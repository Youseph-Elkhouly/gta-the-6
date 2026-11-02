# GTA: THE 6 — Codex handoff

Updated 2026-11-01. This file replaces an older brief that described a 700 m TypeScript
prototype. That prototype is not the game. Work in `city/`. Treat `city/README.md` as
the developer source of truth. The root `README.md` is partly stale: it still says
to deploy the `car-stains` branch to Render. Production is Cloudflare, from `main`.

Do not commit, push, or deploy unless the user asks. `main` is one commit ahead of
`origin/main` (`93e7023`, README player). Leave that unpushed.

## What this is

A browser open-world Toronto. Walk, cycle, drive, fly, ride streetcars and the
subway, talk to 15 parody cameos, and enter parked or traffic cars. The map is
real geodata, not a handmade block.

Live site: https://sloptoronto.ca/explore

The live page loads `toronto-geodata.bin?v=d0f4a95703d2`. That prefix is the sha256
of `city/data/toronto-geodata.bin` (2,240,305 bytes), decoded 2026-11-01.

Playable box (`GEO.frame.detail`): x −7900..3700, z −3000..3600. 1 unit = 1 metre,
+x east, +z south, origin Union Station (43.6453, −79.3806). About 11.6 km by 6.6 km.

## Run

```sh
cd city
npm ci
npm run dev
```

Dev server: http://127.0.0.1:5530/ (landing) and http://127.0.0.1:5530/explore.html
(the game). Use this server. It sends `Cache-Control: no-store` and reloads open tabs.

```sh
npm test          # node --test tests/*.cjs tests/*.mjs
npm run build     # writes city/dist/
```

Tests use the committed geodata. They do not need `~/.cache/slop-toronto`.
`npm run test:geodata` does, and it is not part of `npm test`.

## Stack and entry

Classic scripts, not the old `src/*.ts` app. Three.js 0.186.1, WebGPURenderer and
TSL, WebGL2 fallback without volumetric clouds. No app framework.

- `city/explore.html` lists the scripts in order. The game is `window.CITY`.
- `city/js/main.js` boots the scene, mounts cameos and combat, and runs the frame.
- `city/js/controllers.js` owns the player: on foot, car, bicycle, helicopter.
- `city/js/geodata-loader.js` unpacks `city/data/toronto-geodata.bin` into
  `window.CITY.GEO`, `POLES`, and `PARKED_CARS`.
- `city/js/city-config.js` turns that into roads, blocks, landmarks, and teleports.
- `city/js/buildings.js` draws every `GEO.buildings` row as boxes.
  `?massing=1` swaps in polygons from `city/data/toronto-massing.bin`.
- `city/js/quality.js` picks the tier before other scripts read `window.CITY.QUALITY`.
  Desktop default is `high`.

Frame order in `main.js`: combat preUpdate, controller update (poses the player),
cameos update, combat postUpdate.

## Verified counts (2026-11-01)

Counted by decoding the binary and running `city-config.js`, `characters.js`, and
`mappedPoleSites` against it. Do not replace these with the old handoff's
291 buildings / 524 roads, or with the design-doc figure of 428,184 city-wide
massing records. That shapefile is not in the checkout and was not re-counted.

| What | Count | Kind |
| --- | --- | --- |
| Building footprints | 35,266 | Dataset, and the default render |
| Massing polygons | 35,254 of those rows | Only with `?massing=1`; 12 rings stay boxes |
| Road segments | 8,682 | Dataset; 1,383 unique non-empty names; 3,127 unnamed |
| Road graph | 8,698 nodes, 5,464 links, 810 names | Different list from the 1,383 segment names |
| Talkable cameos | 15 registered, 15 placed | Deadmau5 moves from Rebel to the CN Tower |
| Car bodies | 6 + 1 bus | sedan, SUV, taxi, pickup, van, minivan, bus |
| Other meshes | helicopter, bicycle, Flexity streetcar, subway car, GO loco, GO coach, Bike Share bike | Police is a sedan livery |
| Desktop traffic | 200 cars, 12 buses, 340 pedestrians | `quality.js` high; `traffic.js` instances that many |
| Parked cars | 11,012 cars, 14,857 stalls | High cap is 12,000; lane drops happen at traffic build and were not re-counted |
| Teleports | 12, all with a heading | `TELEPORT_LOCATIONS` |
| Landmarks | 19 sites, 16 labeled | `GEO.landmarks` / `CITY_LANDMARKS` |
| Street trees | 57,120 mapped, 57,010 kept | 110 fail `treeOffRail`; 11 EZ-Tree models |
| Poles placed | 34,476 | 36,534 shipped records; 1,521 in the roadway, 537 under a deck |
| Bike Share | 481 stations, 10,428 docks | Feed 2026-10-26; 418 kiosks |
| TTC timetable | 36 routes, 96 patterns, 919 stops | 13 streetcar, 2 subway, 21 bus; GTFS modified 2026-09-30 |
| Subway | 30 stations, 96 entrances | Train count follows headway, not a constant |
| POIs / signals | 13,657 POIs; 476 junctions; 2,182 crossings | From 2,940 signal points |
| Street furniture | 8,374 hydrants, 23,148 bike rings, 1,122 shelters, 4,554 bins, 694 post boxes, 240 park signs | Dataset |

Streetcar, subway, and GO fleets are computed from track length and the hour's
headway. Do not invent a fleet size.

## Characters (current, and the unfinished swap)

Shipped characters are procedural. `city/js/pedestrians.js` builds a lofted
15-bone body and draws the crowd as instanced meshes. Faces are shader marks on
the head, not a textured mesh. Reserved seeds: −1 player (white tank, blue jeans),
−2 Tobi, −3 Jensen. `city/js/characters.js` places the 15 cameos with that same
rig. Tobi also gets a primitive flat cap and beard parented to the head joint.
`city/js/combat.js` IK-poses the procedural right arm and world-places the pistol.

The player is created in `controllers.js` `createPersonEntity()` (seed −1).
`setAvatarVisible` must hide the crowd meshes. They are not children of the
player object. `poseCharacters` draws the player through the crowd.

A character-mesh swap was started and then stopped before it was wired in.
Do not resume it unless the user asks. If you do:

- `city/js/cast-recipes.js` is untracked and unused. Nothing imports it. It
  describes look recipes for a `cast.js` that does not exist.
- `city/assets/characters/` is untracked and must not be committed. It holds a
  Ready Player Me sample body (`_src/readyplayer.me.glb`, wedding outfit and
  cowboy hat), an ARKit `facecap.glb` that is not a body, extracted textures,
  and four RPM animation clips (`M_Standing_Idle_001`, `M_Walk_001`, `M_Run_001`,
  `M_Walk_Jump_001`). The animation library license allows use with RPM avatars
  and forbids redistributing the animation files. The walk clip's hips translate
  in Z (about 0 to 3.21 over 1.92 s). It is not in-place.
- Do not add more Three.js primitive stand-ins and call the swap done. The
  current procedural body is still what the game draws.

## Deploy

Cloudflare Worker `slop-toronto`, static assets from `city/dist/`. Dashboard has
no Git build. Merging to `main` does not publish.

From a clean `city/` checkout of `main`:

```sh
npm ci && npm run build && npx wrangler@4 deploy
```

`rooms/` is a separate Worker. Deploy it only when `rooms/` changes. After a
deploy, confirm video range requests return 206. See `city/README.md` Publish.

## Do not

- Edit the retired root TypeScript app (`src/`, `public/data/`, `scripts/*.py`)
  as if it were the game.
- Commit `city/assets/characters/` or any Ready Player Me / Mixamo binary.
- Reset or overwrite the untracked character files unless the user says to delete
  them.
- Quote 291 buildings, 524 roads, a 700 m box, or 428,184 city-wide footprints.
- Push, force-push, or `wrangler deploy` unless the user asks.
- Add a paid API or an API key. Street-level comparison and live transit stay on
  the existing no-key paths.
