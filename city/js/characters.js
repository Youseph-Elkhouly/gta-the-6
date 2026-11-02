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
    { id: 'drake', name: 'Drake', place: 'OVO Athletic Centre', address: '90 Princes\' Blvd, Exhibition Place', lat: 43.6335, lon: -79.4165, fallback: 'ontarioPlace', seed: 0.13, hair: 0.18, girth: 1.15, scale: 1.02, aliases: ['drake'], lines: ['Toronto teaches you timing. The cold, the traffic, the people—everything makes you wait for your moment.', 'Everybody wants the view from the top. Nobody asks what it costs to keep the lights on up there.', 'Move smart through the city. The 6 remembers who showed love before the cameras arrived.', 'Now go make a story worth putting on the next record.'] },
    { id: 'tobi', name: 'Tobi Lütke', place: 'King Portland Centre', address: '620 King St W', lat: 43.6444, lon: -79.4014, fallback: 'kensington', seed: -2, hair: 0, girth: 0.98, scale: 1, hat: true, aliases: ['tobi', 'lutke', 'tobi lutke'], lines: ['A city is a platform too. Streets are the interface; every shop is somebody shipping an idea.', 'Perfect plans are usually fear wearing a nice jacket. Build the smallest useful thing and learn from reality.', 'Scale only makes the truth louder. Good systems get better; bad ones become expensive.', 'You have enough information. Ship your next move.'] },
    { id: 'sam', name: 'Sam Altman', place: 'Metro Toronto Convention Centre', address: '255 Front St W', lat: 43.6434, lon: -79.3873, fallback: 'unionStation', seed: 0.01, hair: 0.22, girth: 0.94, scale: 1, aliases: ['sam', 'altman', 'sam altman'], lines: ['The future never arrives all at once. It shows up as a strange demo, then suddenly everybody depends on it.', 'Capability is the easy headline. The harder question is who gets agency when the system becomes powerful.', 'Toronto has the right kind of ambition—serious work, low drama, excellent arguments over coffee.', 'Stay curious, but keep your hand on the steering wheel.'] },
    { id: 'jensen', name: 'Jensen Huang', place: 'MaRS Discovery District', address: '101 College St', lat: 43.6597, lon: -79.3900, fallback: 'rom', seed: -3, hair: 0.48, girth: 1.02, scale: 1, aliases: ['jensen', 'huang', 'jensen huang'], lines: ['Every impossible thing starts as a workload nobody knows how to run fast enough.', 'Accelerated computing is not about one chip. It is the whole stack agreeing to move together.', 'The leather jacket saves decision time. The architecture takes slightly longer.', 'Build for the problem that will matter in ten years, then survive long enough to see it.'] },
    { id: 'hinton', name: 'Geoffrey Hinton', place: 'University of Toronto', address: 'King\'s College Circle', lat: 43.6607, lon: -79.3956, fallback: 'legislature', seed: 0.17, hair: 0.55, girth: 0.92, scale: 0.98, aliases: ['hinton', 'geoffrey', 'geoffrey hinton'], lines: ['For years we asked whether a machine could learn. We should have spent more time asking what happens when it learns too well.', 'Intelligence is not the same thing as wisdom. Humans demonstrate that rather convincingly.', 'The work was exciting because it seemed impossible. The consequences are serious for exactly the same reason.', 'Keep asking uncomfortable questions. Optimism is useful; scrutiny is essential.'] },
    { id: 'chow', name: 'Olivia Chow', place: 'Toronto City Hall', address: '100 Queen St W', lat: 43.6534, lon: -79.3841, fallback: 'cityHall', female: true, seed: 0.09, hair: 0.85, girth: 0.9, scale: 0.94, aliases: ['olivia', 'chow', 'olivia chow'], lines: ['Toronto belongs to the people who keep showing up for one another—on the bus, at the library, and on every block.', 'A good city does not ask whether you are rich before it gives you a safe street, a warm home, or a way to get around.', 'The bicycle is still the fastest way through downtown. I have tested this more than once.', 'Take care of your neighbours. That is how a city becomes a community.'] },
    { id: 'kawhi', name: 'Kawhi Leonard', place: 'Scotiabank Arena', address: '40 Bay St', lat: 43.6435, lon: -79.3791, fallback: 'rogersCentre', seed: 0.14, hair: 0.08, girth: 1.18, scale: 1.1, aliases: ['kawhi', 'leonard', 'kawhi leonard'], lines: ['Toronto remembers the work. Not the noise before the game—the possessions when everybody stayed locked in.', 'Pressure is just the moment asking whether you prepared for it.', 'One bounce can feel like four when the whole country is holding its breath.', 'Stay patient. Get to your spot. Finish the play.'] }
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
      invulnerable: r.invulnerable !== false,
      combatRole: r.combatRole || 'protected',
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
  let cinematic = null;
  let conversationLight = null;
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
    conversationLight = new THREE.PointLight(0xffd7ad, 54, 13, 2);
    conversationLight.name = 'CameoConversationFill';
    conversationLight.visible = false;
    conversationLight.castShadow = false;
    scene.add(conversationLight);
    rigs = CHARACTERS.map((c) => {
      const rig = new PersonRig({ seed: c.look.seed, scale: c.look.scale, female: c.look.female, girth: c.look.girth, hair: c.look.hair });
      rig.reset(c.npc.x, c.npc.z, c.homeYaw || c.npc.yaw, ground);
      c.rig = rig;
      if (window.CITY.CAST_PRIORITY?.includes(c.id) && window.CITY.cast) {
        c.castActor = window.CITY.cast.create(c.id, {
          scene,
          onReady: () => {
            if (c.hat) c.hat.visible = c.beard.visible = false;
          }
        });
      }
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
    if (conversationLight) {
      conversationLight.visible = !!talking;
      if (talking) conversationLight.position.copy(cam);
    }
    crowd.begin();
    for (let i = 0; i < CHARACTERS.length; i++) {
      const c = CHARACTERS[i];
      const d = Math.hypot(cam.x - c.npc.x, cam.z - c.npc.z);
      const el = labels[i];
      if (d > 110) {
        el.hidden = true;
        c.castActor?.setVisible(false);
        if (c.hat) c.hat.visible = c.beard.visible = false;
        continue;
      }
      let yaw = c.homeYaw || c.npc.yaw;
      if (playerEnt) {
        const pd = Math.hypot(playerEnt.position.x - c.npc.x, playerEnt.position.z - c.npc.z);
        if (pd < 8) yaw = Math.atan2(playerEnt.position.x - c.npc.x, playerEnt.position.z - c.npc.z);
      }
      c.rig.update(step, c.npc.x, c.npc.z, yaw, ground);
      if (c.castActor) {
        c.castActor.setTransform(c.npc.x, ground(c, c.npc.x, c.npc.z), c.npc.z, yaw);
        c.castActor.setVisible(true);
        c.castActor.update(step, { talking: talking === c });
      }
      if (c.hat && !c.castActor?.ready) {
        poseAccessory(c.hat, c.rig, 0, 0.078, 0.04);
        poseAccessory(c.beard, c.rig, 0, -0.04, 0.085);
      } else if (c.hat) {
        c.hat.visible = c.beard.visible = false;
      }
      if (!c.castActor?.ready) crowd.add(c.rig, d);
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

  function frameConversation(character, playerEnt, immediate = false) {
    const app = window.__CITY_APP;
    const cameras = app?.cameraSystem;
    if (!cameras || !character || !playerEnt) return;
    if (!cinematic) {
      cinematic = {
        previous: cameras.cinema,
        fov: cameras.camera.fov,
        fromPos: cameras.currentPos.clone(),
        fromLook: cameras.currentLookAt.clone(),
        started: performance.now()
      };
    } else {
      cinematic.fromPos.copy(cameras.currentPos);
      cinematic.fromLook.copy(cameras.currentLookAt);
      cinematic.started = performance.now();
    }
    const baseY = ground(character, character.npc.x, character.npc.z);
    const target = new THREE.Vector3(character.npc.x, baseY + 1.5, character.npc.z);
    const towardPlayer = new THREE.Vector3(
      playerEnt.position.x - character.npc.x, 0,
      playerEnt.position.z - character.npc.z
    );
    if (towardPlayer.lengthSq() < 0.01) towardPlayer.set(0, 0, 1);
    towardPlayer.normalize();
    const side = new THREE.Vector3(-towardPlayer.z, 0, towardPlayer.x);
    const sideSign = line % 2 ? -1 : 1;
    const destination = target.clone()
      .addScaledVector(towardPlayer, line % 2 ? 2.35 : 2.7)
      .addScaledVector(side, sideSign * (line % 2 ? 0.78 : 1.05));
    destination.y += line % 2 ? 0.05 : 0.18;
    const fromPos = cinematic.fromPos.clone();
    const fromLook = cinematic.fromLook.clone();
    const started = immediate ? performance.now() - 850 : cinematic.started;
    cameras.cinema = () => {
      const raw = Math.min(1, Math.max(0, (performance.now() - started) / 850));
      const ease = raw * raw * (3 - 2 * raw);
      const drift = Math.sin(performance.now() * 0.00032) * 0.12;
      const pos = fromPos.clone().lerp(destination, ease).addScaledVector(side, drift * ease);
      const look = fromLook.clone().lerp(target, ease);
      return { pos: pos.toArray(), look: look.toArray(), fov: 43 };
    };
  }

  function endConversationCamera() {
    const cameras = window.__CITY_APP?.cameraSystem;
    if (cameras && cinematic) {
      cameras.cinema = cinematic.previous;
      cameras.camera.fov = cinematic.fov;
      cameras.camera.updateProjectionMatrix();
      cameras.initialized = false;
    }
    cinematic = null;
    document.body.classList.remove('cameo-cinematic');
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
    ent.heading = Math.atan2(near.npc.x - ent.position.x, near.npc.z - ent.position.z);
    document.body.classList.add('cameo-cinematic');
    frameConversation(near, ent);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    box.hidden = false;
    prompt.hidden = true;
    showLine();
    return true;
  }

  function advance() {
    if (!talking) return;
    if (line >= talking.lines.length - 1) close();
    else {
      line += 1;
      showLine();
      const ent = window.__CITY_APP?.controllerManager.getActiveEntity();
      if (ent) frameConversation(talking, ent);
    }
  }

  function close() {
    endConversationCamera();
    talking = null;
    line = 0;
    window.CITY.cameoTalk = false;
    if (box) box.hidden = true;
  }

  // The engine rejects a stand that clips a wall or a parked vehicle, then hunts in 4 m rings
  // and can drop the player on the NPC. Prefer another sidewalk point 3–6 m away that it will accept.
  function usableStand(c) {
    const cm = window.__CITY_APP && window.__CITY_APP.controllerManager;
    if (!cm || !cm.findTeleportPosition) return c.stand;
    const tryPoint = (x, z) => {
      const gap = Math.hypot(x - c.npc.x, z - c.npc.z);
      if (gap < 3.2 || gap > 6 || !safeWalk(x, z)) return null;
      const heading = Math.atan2(c.npc.x - x, c.npc.z - z);
      return cm.findTeleportPosition(x, z, heading, null, true) ? { x, z, heading, y: null } : null;
    };
    const first = tryPoint(c.stand.x, c.stand.z);
    if (first) return first;
    const dx = c.stand.x - c.npc.x;
    const dz = c.stand.z - c.npc.z;
    const len = Math.hypot(dx, dz) || 1;
    const hx = dx / len;
    const hz = dz / len;
    const px = -hz;
    const pz = hx;
    for (const dist of [4.4, 5.1, 3.6, 4.8, 4.0]) {
      for (const dir of [1, -1]) {
        for (const lat of [0, 0.7, -0.7, 1.3, -1.3]) {
          const found = tryPoint(c.npc.x + hx * dir * dist + px * lat, c.npc.z + hz * dir * dist + pz * lat);
          if (found) return found;
        }
      }
    }
    return c.stand;
  }

  function teleportToCharacter(id) {
    const c = CHARACTERS.find((p) => p.id === id);
    const app = window.__CITY_APP;
    if (!c || !app) return false;
    close();
    if (app.controllerManager.activeMode !== 'person') app.selectMode('person');
    const stand = usableStand(c);
    app.teleportTo(stand.x, stand.z, stand.heading, stand.y);
    return true;
  }

  window.CITY.CHARACTERS = CHARACTERS;
  window.CITY.CAMEO_SWAPS = swaps;
  window.CITY.teleportToCharacter = teleportToCharacter;
  window.CITY.cameos = { mount, update, tryTalk, advance, close };
})();
