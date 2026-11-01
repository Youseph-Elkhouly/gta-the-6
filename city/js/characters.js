// Satirical cameos. These are not the real people, and nothing here says they endorse the game.
// Spots are public landmarks. A landmark with no street inside the loaded city is swapped for one that has.
(function () {
  const {
    worldFromLatLon, latLonFromWorld, streetArrival, CITY_BOUNDS, TELEPORT_LOCATIONS,
    blockAt, waterAt, isOnLand, PersonRig, PersonCrowd, THREE
  } = window.CITY;

  const FALLBACK_NAMES = {
    cnTower: 'CN Tower',
    rogersCentre: 'Rogers Centre',
    unionStation: 'Union Station',
    cityHall: 'Toronto City Hall',
    rom: 'Royal Ontario Museum',
    ontarioPlace: 'Ontario Place',
    stLawrence: 'St. Lawrence Market',
    distillery: 'Distillery District',
    sugarBeach: 'Sugar Beach',
    harbourfront: 'Harbourfront',
    legislature: "Queen's Park",
    kensington: 'Kensington Market',
    start: 'the waterfront trail'
  };

  // lat/lon are the public landmark. fallback is a teleport spot already in this city, used only if the landmark has no street.
  const ROSTER = [
    { id: 'drake', name: 'Drake', place: 'OVO Athletic Centre', address: '90 Princes\' Blvd, Exhibition Place', lat: 43.6335, lon: -79.4165, fallback: 'ontarioPlace', seed: 0.13, hair: 0.18, girth: 1.15, scale: 1.02, aliases: ['drake'], lines: ['You made it to the 6. Don\'t get too comfortable.', 'OVO is a state of mind. The street is not.', 'If you\'re lost, you\'re just early.'] },
    { id: 'tobi', name: 'Tobi Lütke', place: 'King Portland Centre', address: '620 King St W', lat: 43.6444, lon: -79.4014, fallback: 'kensington', seed: -2, hair: 0, girth: 0.98, scale: 1, hat: true, aliases: ['tobi', 'lutke', 'tobi lutke'], lines: ['I built a store. Somehow it became an empire.', 'Ship the thing. Then ship the next thing.', 'The city is a marketplace if you squint.'] },
    { id: 'sam', name: 'Sam Altman', place: 'Metro Toronto Convention Centre', address: '255 Front St W', lat: 43.6434, lon: -79.3873, fallback: 'unionStation', seed: 0.01, hair: 0.22, girth: 0.94, scale: 1, aliases: ['sam', 'altman', 'sam altman'], lines: ['We\'re five minutes away from AGI. Again.', 'Don\'t worry about the details. The model will.', 'I was only in town for the keynote.'] },
    { id: 'jensen', name: 'Jensen Huang', place: 'MaRS Discovery District', address: '101 College St', lat: 43.6597, lon: -79.3900, fallback: 'rom', seed: -3, hair: 0.48, girth: 1.02, scale: 1, aliases: ['jensen', 'huang', 'jensen huang'], lines: ['You need more GPUs. Everyone needs more GPUs.', 'The leather jacket is a uniform. The chips are the point.', 'This block could use a data centre.'] },
    { id: 'hinton', name: 'Geoffrey Hinton', place: 'University of Toronto', address: 'King\'s College Circle', lat: 43.6607, lon: -79.3956, fallback: 'legislature', seed: 0.17, hair: 0.55, girth: 0.92, scale: 0.98, aliases: ['hinton', 'geoffrey', 'geoffrey hinton'], lines: ['I helped build the thing I\'m warning you about.', 'Be careful what you train.', 'The campus looks smaller from the sidewalk.'] },
    { id: 'elon', name: 'Elon Musk', place: 'Tesla, Liberty Village', address: '1325 Dundas St W', lat: 43.6496, lon: -79.4248, fallback: 'harbourfront', seed: 0.08, hair: 0.12, girth: 1.06, scale: 1.02, aliases: ['elon', 'musk', 'elon musk'], lines: ['The robotaxi arrives next year. Probably.', 'I\'m posting through it.', 'Mars can wait. The light is red.'] },
    { id: 'chow', name: 'Olivia Chow', place: 'Toronto City Hall', address: '100 Queen St W', lat: 43.6534, lon: -79.3841, fallback: 'cityHall', female: true, seed: 0.09, hair: 0.85, girth: 0.9, scale: 0.94, aliases: ['olivia', 'chow', 'olivia chow'], lines: ['Have you considered taking the TTC?', 'The city works when people share the street.', 'Mind the cyclists. They\'re faster than they look.'] },
    { id: 'trudeau', name: 'Justin Trudeau', place: "Queen's Park", address: 'Queen\'s Park north lawn', lat: 43.6648, lon: -79.3925, fallback: 'legislature', seed: 0.07, hair: 0.48, girth: 0.98, scale: 1, aliases: ['trudeau', 'justin', 'justin trudeau'], lines: ['I\'m just visiting.', 'Sunny ways, even when the lake wind cuts through.', 'Nice jacket. Very practical.'] },
    { id: 'kawhi', name: 'Kawhi Leonard', place: 'Scotiabank Arena', address: '40 Bay St', lat: 43.6435, lon: -79.3791, fallback: 'rogersCentre', seed: 0.14, hair: 0.08, girth: 1.18, scale: 1.1, aliases: ['kawhi', 'leonard', 'kawhi leonard'], lines: ['Board man gets paid.', 'I\'m only here for the series.', 'Keep it moving.'] },
    { id: 'weeknd', name: 'The Weeknd', place: 'Queen Street West', address: 'Queen St W at Spadina', lat: 43.6496, lon: -79.3962, fallback: 'stLawrence', seed: 0.05, hair: 0.62, girth: 0.93, scale: 1, aliases: ['weeknd', 'the weeknd'], lines: ['The city\'s different after dark.', 'Don\'t save me. I like the walk.', 'Queen Street remembers everything.'] },
    { id: 'nav', name: 'NAV', place: 'Entertainment District', address: 'John St at Richmond St W', lat: 43.6486, lon: -79.3904, fallback: 'cnTower', seed: 0.19, hair: 0.28, girth: 1.04, scale: 1, aliases: ['nav'], lines: ['Even the NPCs know my producer tag.', 'Keep it pushing.', 'If you hear the tag, you\'re already late.'] },
    { id: 'reynolds', name: 'Ryan Reynolds', place: 'TIFF Lightbox', address: '350 King St W', lat: 43.6466, lon: -79.3902, fallback: 'distillery', seed: 0.16, hair: 0.3, girth: 1.06, scale: 1.02, aliases: ['ryan', 'reynolds', 'ryan reynolds'], lines: ['This cameo wasn\'t in the budget.', 'I\'m contractually obligated to look surprised.', 'Deadpool would\'ve charged extra.'] },
    { id: 'deadmau5', name: 'Deadmau5', place: 'Rebel', address: '11 Polson St', lat: 43.6406, lon: -79.3536, fallback: 'sugarBeach', seed: 0.2, hair: 0.05, girth: 1.0, scale: 1, aliases: ['deadmau5', 'joel'], lines: ['I was told there would be better speakers.', 'The mouse head is in the car. Don\'t ask.', 'Turn it up. Then turn it down. I\'m particular.'] },
    { id: 'ford', name: 'Doug Ford', place: 'Ontario Legislative Building', address: 'Queen\'s Park', lat: 43.6622, lon: -79.3915, fallback: 'cityHall', seed: 0.18, hair: 0.2, girth: 1.16, scale: 1.04, aliases: ['doug', 'ford', 'doug ford'], lines: ['Folks, I\'ve got a plan.', 'We\'re getting it done. The details are downtown.', 'That was a different meeting.'] },
    { id: 'keanu', name: 'Keanu Reeves', place: 'Royal Alexandra Theatre', address: '260 King St W', lat: 43.6473, lon: -79.3873, fallback: 'harbourfront', seed: 0.03, hair: 0.5, girth: 1.0, scale: 1.03, aliases: ['keanu', 'reeves', 'keanu reeves'], lines: ['Nice city. Watch your step.', 'You\'re breathtaking. The intersection is not.', 'Be kind. Then cross on the signal.'] }
  ];

  const inCity = (x, z) => x > CITY_BOUNDS.minX + 40 && x < CITY_BOUNDS.maxX - 40 && z > CITY_BOUNDS.minZ + 40 && z < CITY_BOUNDS.maxZ - 40;
  const cell = (x, z) => `${Math.round(x / 5)},${Math.round(z / 5)}`;
  let buildingAt = () => false;
  try {
    if (window.CITY.buildingIndex && window.CITY.GEO) buildingAt = window.CITY.buildingIndex(window.CITY.GEO);
  } catch (err) {
    buildingAt = () => false;
  }
  let reject = () => false;

  // A curb island that isn't a median, clear of buildings, water, tracks and flyovers.
  function safeWalk(x, z) {
    if (!isOnLand(x, z, 2) || waterAt(x, z)) return false;
    const block = blockAt(x, z);
    if (!block || block.median) return false;
    if (buildingAt(x, z, 1)) return false;
    if (buildingAt(x + 0.5, z, 1) || buildingAt(x - 0.5, z, 1) || buildingAt(x, z + 0.5, 1) || buildingAt(x, z - 0.5, 1)) return false;
    if (window.CITY.subwayCutAt && window.CITY.subwayCutAt(x, z, 1, false)) return false;
    if (window.CITY.deckHeightAt && window.CITY.deckHeightAt(x, z, 1.5) > 2) return false;
    if (reject(x, z)) return false;
    return true;
  }

  // Sidewalk samples: past the carriageway edge, on the curb island, nearest the landmark first.
  function samplesAround(origin) {
    const out = [];
    const roads = window.CITY.nearestRoads(origin.x, origin.z, 120)
      .filter((n) => n.road && n.road.cls !== 'motorway' && n.road.cls !== 'motorway_link' && !n.road.raised);
    for (const n of roads.slice(0, 6)) {
      const half = Math.max(3.2, (n.road.w || 8) * 0.5);
      const sx = -n.dz;
      const sz = n.dx;
      for (const along of [0, 6, -6, 12, -12, 18, -18, 26, -26, 34, -34]) {
        for (const sign of [1, -1]) {
          for (const extra of [1.8, 2.6, 3.4, 4.4]) {
            const x = n.px + n.dx * along + sx * sign * (half + extra);
            const z = n.pz + n.dz * along + sz * sign * (half + extra);
            const dLand = Math.hypot(x - origin.x, z - origin.z);
            if (dLand > 85) continue;
            out.push({ x, z, dLand, hx: n.dx, hz: n.dz, extra });
          }
        }
      }
    }
    out.sort((a, b) => a.dLand - b.dLand || a.extra - b.extra);
    return out;
  }

  // NPC on the sidewalk. Player 3–6 m further along it, heading just off the NPC so the chase camera shows them.
  function pairFrom(origin, taken) {
    for (const s of samplesAround(origin)) {
      if (!safeWalk(s.x, s.z) || taken.has(cell(s.x, s.z))) continue;
      for (const dir of [1, -1]) {
        for (const dist of [4.4, 5.1, 3.6]) {
          const px = s.x + s.hx * dir * dist;
          const pz = s.z + s.hz * dir * dist;
          const d = Math.hypot(px - s.x, pz - s.z);
          if (d < 3 || d > 6 || !safeWalk(px, pz) || taken.has(cell(px, pz))) continue;
          const toward = Math.atan2(s.x - px, s.z - pz);
          // A small yaw puts the NPC beside the player's shoulder. Keep the camera over open ground, not in the facade.
          const camClear = (h) => {
            const cx = px - Math.sin(h) * 3.4;
            const cz = pz - Math.cos(h) * 3.4;
            return isOnLand(cx, cz, 1) && !waterAt(cx, cz) && !buildingAt(cx, cz, 1);
          };
          let heading = toward;
          if (camClear(toward + 0.26)) heading = toward + 0.26;
          else if (camClear(toward - 0.26)) heading = toward - 0.26;
          return {
            npc: { x: s.x, z: s.z, yaw: Math.atan2(px - s.x, pz - s.z) },
            stand: { x: px, z: pz, heading, y: null },
            homeYaw: Math.atan2(px - s.x, pz - s.z)
          };
        }
      }
    }
    return null;
  }

  const taken = new Set();
  function fallbackSpot(prefer) {
    const order = [prefer, 'cnTower', 'rogersCentre', 'unionStation', 'cityHall', 'rom', 'ontarioPlace', 'stLawrence', 'distillery', 'sugarBeach', 'harbourfront', 'legislature', 'kensington', 'start'];
    for (const key of order) {
      const loc = TELEPORT_LOCATIONS[key];
      if (!loc || loc.heading === undefined) continue;
      if (taken.has(cell(loc.x, loc.z))) continue;
      return { key, loc };
    }
    const loc = TELEPORT_LOCATIONS.start || TELEPORT_LOCATIONS.cnTower;
    return { key: loc === TELEPORT_LOCATIONS.start ? 'start' : 'cnTower', loc };
  }

  const swaps = [];
  function layDown(r, taken) {
    const origin = worldFromLatLon(r.lat, r.lon);
    let pose = inCity(origin.x, origin.z) ? pairFrom(origin, taken) : null;
    let place = r.place;
    let address = r.address;
    let lat = r.lat;
    let lon = r.lon;
    let swapped = null;
    if (!pose) {
      const fb = fallbackSpot(r.fallback);
      pose = pairFrom(fb.loc, taken);
      place = FALLBACK_NAMES[fb.key] || fb.key;
      address = place;
      if (pose) {
        const geo = latLonFromWorld(pose.npc.x, pose.npc.z);
        lat = geo.lat;
        lon = geo.lon;
      }
      swapped = { wanted: r.place, using: place };
      swaps.push({ id: r.id, name: r.name, wanted: r.place, using: place });
    }
    if (pose) {
      taken.add(cell(pose.npc.x, pose.npc.z));
      taken.add(cell(pose.stand.x, pose.stand.z));
    }
    return { place, address, lat, lon, swapped, pose };
  }

  const CHARACTERS = ROSTER.map((r) => {
    const spot = layDown(r, taken);
    const pose = spot.pose || { npc: { x: 0, z: 0, yaw: 0 }, stand: { x: 4, z: 0, heading: Math.PI, y: null }, homeYaw: 0 };
    return {
      id: r.id,
      name: r.name,
      place: spot.place,
      wanted: r.place,
      address: spot.address,
      lat: spot.lat,
      lon: spot.lon,
      swapped: spot.swapped,
      lines: r.lines,
      aliases: r.aliases,
      radius: 6.4,
      stand: pose.stand,
      npc: pose.npc,
      homeYaw: pose.homeYaw,
      look: { seed: r.seed, hair: r.hair, girth: r.girth, scale: r.scale, female: !!r.female, hat: !!r.hat }
    };
  });

  let crowd = null;
  let rigs = null;
  let layer = null;
  let labels = null;
  let prompt = null;
  let box = null;
  let whoEl = null;
  let lineEl = null;
  let hintEl = null;
  let talking = null;
  let line = 0;
  const tmp = new THREE.Vector3();
  const headQ = new THREE.Quaternion();
  const headP = new THREE.Vector3();
  const headBind = new THREE.Vector3();
  const hatTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.32);

  function headJoint(rig) {
    const o = 2 * 8;
    const a = rig.pose;
    headQ.set(a[o], a[o + 1], a[o + 2], a[o + 3]);
    const bind = rig.bind[2];
    headBind.set(bind.x, bind.y, bind.z).applyQuaternion(headQ).multiplyScalar(a[o + 7] || rig.s);
    return headP.set(a[o + 4] + headBind.x, a[o + 5] + headBind.y, a[o + 6] + headBind.z);
  }

  // Dark charcoal flat cap: a low soft crown and a short brim that curves down over the forehead.
  function makeFlatCap() {
    const wool = new THREE.MeshStandardNodeMaterial({ color: 0x2a2e33, roughness: 0.92, metalness: 0 });
    const g = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), wool);
    crown.scale.set(1.08, 0.5, 1.05);
    crown.position.y = 0.012;
    const brim = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 8, 0, Math.PI, 0, Math.PI * 0.32), wool);
    brim.scale.set(1.2, 0.42, 1);
    brim.rotation.x = 0.7;
    brim.position.set(0, -0.012, 0.055);
    crown.castShadow = brim.castShadow = true;
    g.add(crown, brim);
    return g;
  }

  function makeBeard() {
    const fur = new THREE.MeshStandardNodeMaterial({ color: 0x3a2c1e, roughness: 0.92, metalness: 0 });
    const g = new THREE.Group();
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), fur);
    jaw.scale.set(1.35, 0.85, 0.9);
    jaw.position.z = 0.02;
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), fur);
    chin.position.set(0, -0.05, 0.03);
    jaw.castShadow = true;
    g.add(jaw, chin);
    return g;
  }

  function treeGrid() {
    const g = new Map();
    for (const t of window.CITY.streetTreePositions || []) {
      const k = Math.floor(t.x / 16) * 100000 + Math.floor(t.z / 16);
      (g.get(k) || g.set(k, []).get(k)).push(t);
    }
    return g;
  }

  function nearTree(g, x, z) {
    const ix = Math.floor(x / 16);
    const iz = Math.floor(z / 16);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = g.get((ix + a) * 100000 + (iz + b));
      if (!list) continue;
      for (const t of list) if (Math.hypot(t.x - x, t.z - z) < 1.15) return true;
    }
    return false;
  }

  // Once the trees and colliders exist, move anyone who landed in one onto the next clear sidewalk sample.
  function settle() {
    const g = treeGrid();
    reject = (x, z) => nearTree(g, x, z);
    swaps.length = 0;
    const fresh = new Set();
    for (const c of CHARACTERS) {
      const r = ROSTER.find((p) => p.id === c.id);
      const spot = layDown(r, fresh);
      if (!spot.pose) continue;
      c.npc.x = spot.pose.npc.x;
      c.npc.z = spot.pose.npc.z;
      c.npc.yaw = spot.pose.npc.yaw;
      c.stand = spot.pose.stand;
      c.homeYaw = spot.pose.homeYaw;
      c.place = spot.place;
      c.swapped = spot.swapped;
    }
    reject = () => false;
  }

  function ground(_owner, x, z) {
    const cm = window.__CITY_APP && window.__CITY_APP.controllerManager;
    return cm ? cm.getGroundHeight(x, z, 'person', 0) : (CITY_BOUNDS.sidewalkHeight || 0.22);
  }

  function mount(scene) {
    if (crowd || !PersonCrowd || !PersonRig) return;
    settle();
    crowd = new PersonCrowd(CHARACTERS.length, { farDistance: 48, castShadow: true });
    crowd.meshes.forEach((m) => scene.add(m));
    rigs = CHARACTERS.map((c) => {
      const rig = new PersonRig({ seed: c.look.seed, scale: c.look.scale, female: c.look.female, girth: c.look.girth, hair: c.look.hair });
      rig.reset(c.npc.x, c.npc.z, c.homeYaw || c.npc.yaw, ground);
      c.rig = rig;
      if (c.look.hat) {
        c.hat = makeFlatCap();
        c.beard = makeBeard();
        c.hat.visible = c.beard.visible = false;
        scene.add(c.hat, c.beard);
      }
      return rig;
    });
    layer = document.createElement('div');
    layer.id = 'cameo-layer';
    labels = CHARACTERS.map((c) => {
      const el = document.createElement('div');
      el.className = 'cameo-name';
      el.textContent = c.name;
      el.hidden = true;
      layer.appendChild(el);
      return el;
    });
    document.body.appendChild(layer);
    prompt = document.createElement('div');
    prompt.id = 'cameo-prompt';
    prompt.hidden = true;
    prompt.textContent = 'Press E to Talk';
    document.body.appendChild(prompt);
    box = document.createElement('div');
    box.id = 'cameo-box';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    whoEl = document.createElement('div');
    whoEl.className = 'who';
    lineEl = document.createElement('div');
    lineEl.className = 'line';
    hintEl = document.createElement('div');
    hintEl.className = 'hint';
    box.append(whoEl, lineEl, hintEl);
    box.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); advance(); });
    document.body.appendChild(box);
  }

  function nearest(ent) {
    if (!ent) return null;
    let best = null;
    let bestD = Infinity;
    for (const c of CHARACTERS) {
      const d = Math.hypot(ent.position.x - c.npc.x, ent.position.z - c.npc.z);
      if (d < c.radius && d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  function poseAccessory(mesh, rig, ox, oy, oz) {
    const joint = headJoint(rig);
    mesh.quaternion.copy(headQ).multiply(hatTilt);
    mesh.position.copy(joint).add(tmp.set(ox, oy, oz).applyQuaternion(headQ).multiplyScalar(rig.s));
    mesh.visible = true;
  }

  function update(camera, playerEnt, dt) {
    if (!crowd) return;
    const step = Number.isFinite(dt) ? dt : 0.016;
    const cam = camera.position;
    crowd.begin();
    for (let i = 0; i < CHARACTERS.length; i++) {
      const c = CHARACTERS[i];
      const d = Math.hypot(cam.x - c.npc.x, cam.z - c.npc.z);
      const el = labels[i];
      if (d > 110) {
        el.hidden = true;
        if (c.hat) c.hat.visible = c.beard.visible = false;
        continue;
      }
      let yaw = c.homeYaw || c.npc.yaw;
      if (playerEnt) {
        const pd = Math.hypot(playerEnt.position.x - c.npc.x, playerEnt.position.z - c.npc.z);
        if (pd < 8) yaw = Math.atan2(playerEnt.position.x - c.npc.x, playerEnt.position.z - c.npc.z);
      }
      c.rig.update(step, c.npc.x, c.npc.z, yaw, ground);
      if (c.hat) {
        poseAccessory(c.hat, c.rig, 0, 0.078, 0.04);
        poseAccessory(c.beard, c.rig, 0, -0.04, 0.085);
      }
      crowd.add(c.rig, d);
      if (d < 24) {
        tmp.set(c.npc.x, 1.9, c.npc.z).project(camera);
        if (tmp.z < 1) {
          el.hidden = false;
          el.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
          el.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
        } else el.hidden = true;
      } else el.hidden = true;
    }
    crowd.end();
    const app = window.__CITY_APP;
    const onFoot = app && app.controllerManager.activeMode === 'person';
    const near = !talking && onFoot ? nearest(playerEnt) : null;
    prompt.hidden = !near;
  }

  function showLine() {
    if (!talking) return;
    whoEl.textContent = talking.name;
    lineEl.textContent = talking.lines[line];
    hintEl.textContent = line < talking.lines.length - 1 ? 'Space' : 'Space to close';
  }

  function tryTalk() {
    if (talking) return true;
    const app = window.__CITY_APP;
    if (!app || app.controllerManager.activeMode !== 'person') return false;
    const ent = app.controllerManager.getActiveEntity();
    const near = nearest(ent);
    if (!near) return false;
    talking = near;
    line = 0;
    window.CITY.cameoTalk = true;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    box.hidden = false;
    prompt.hidden = true;
    showLine();
    return true;
  }

  function advance() {
    if (!talking) return;
    if (line >= talking.lines.length - 1) close();
    else { line += 1; showLine(); }
  }

  function close() {
    talking = null;
    line = 0;
    window.CITY.cameoTalk = false;
    if (box) box.hidden = true;
  }

  function teleportToCharacter(id) {
    const c = CHARACTERS.find((p) => p.id === id);
    const app = window.__CITY_APP;
    if (!c || !app) return false;
    close();
    if (app.controllerManager.activeMode !== 'person') app.selectMode('person');
    app.teleportTo(c.stand.x, c.stand.z, c.stand.heading, c.stand.y);
    return true;
  }

  window.CITY.CHARACTERS = CHARACTERS;
  window.CITY.CAMEO_SWAPS = swaps;
  window.CITY.teleportToCharacter = teleportToCharacter;
  window.CITY.cameos = { mount, update, tryTalk, advance, close };
})();
