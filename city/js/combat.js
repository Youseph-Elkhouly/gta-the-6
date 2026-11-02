// Third-person pistol. The crosshair is the person's aim projected onto the screen,
// and the shot is that same ray from the chest, so the reticle moves with the body.
// Ambient pedestrians can be hurt. Registry NPCs with invulnerable / combatRole
// "protected" cannot. No wanted level is applied here.
(function () {
  const { THREE } = window.CITY;
  const MAG = 12;
  const RELOAD = 1.5;
  const FIRE_GAP = 0.18;
  const DAMAGE = 34;
  const RANGE = 80;
  const BONE = () => window.CITY.PERSON_BONES;
  const FOLLOW = { chase: true, action: true, pov: true };

  const state = {
    equipped: false,
    remembered: false,
    ammo: MAG,
    reloadLeft: 0,
    recoil: 0,
    lastShot: -1,
    trigger: false,
    mounted: false
  };

  let scene, cm, cameras, traffic, canvas;
  let pistol, flash, hud, cross;
  const pool = [];
  const tracers = [];
  let audioCtx = null;
  let noiseBuf = null;

  const dir = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();
  const screenTarget = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const gunWrist = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const supportTarget = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const front = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const qGun = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3();
  const gunUp = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const camDir = new THREE.Vector3();

  function emit(type, detail) {
    window.CITY.events?.emit(type, detail);
  }

  function onFoot() {
    const app = window.__CITY_APP;
    if (!cm || cm.activeMode !== 'person') return false;
    if (cm.suspended) return false;
    if (app?.rideSession?.active || app?.subwayRide?.inside) return false;
    return true;
  }

  function blocked(event) {
    if (window.CITY.isTypingInField?.(event)) return true;
    const t = event?.target;
    if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) return true;
    if (window.CITY.uiOverlay) return true;
    if (window.CITY.cameoTalk) return true;
    if (window.CITY.wanted?.isDown) return true;
    return false;
  }

  function followCam() {
    return !!(cameras && FOLLOW[cameras.activePresetId]);
  }

  function makePistol() {
    const steel = new THREE.MeshStandardNodeMaterial({ color: 0x3c4046, metalness: 0.74, roughness: 0.34 });
    const dark = new THREE.MeshStandardNodeMaterial({ color: 0x1a1c20, metalness: 0.5, roughness: 0.42 });
    const gripMat = new THREE.MeshStandardNodeMaterial({ color: 0x2c2418, metalness: 0.04, roughness: 0.86 });
    const g = new THREE.Group();
    g.name = 'Pistol';
    const add = (geo, mat, x, y, z) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(0.028, 0.086, 0.036), gripMat, 0, -0.038, -0.012);
    add(new THREE.BoxGeometry(0.022, 0.026, 0.1), dark, 0, 0.01, 0.028);
    add(new THREE.BoxGeometry(0.026, 0.028, 0.145), steel, 0, 0.03, 0.018);
    const barrel = new THREE.CylinderGeometry(0.0065, 0.0065, 0.055, 8);
    barrel.rotateX(Math.PI / 2);
    add(barrel, dark, 0, 0.026, 0.112);
    const crown = new THREE.CylinderGeometry(0.009, 0.008, 0.014, 8);
    crown.rotateX(Math.PI / 2);
    add(crown, steel, 0, 0.026, 0.148);
    add(new THREE.BoxGeometry(0.004, 0.012, 0.006), dark, 0, 0.05, 0.078);
    add(new THREE.BoxGeometry(0.016, 0.01, 0.008), dark, 0, 0.048, -0.046);
    add(new THREE.BoxGeometry(0.008, 0.018, 0.01), dark, 0, 0.038, -0.055);
    add(new THREE.BoxGeometry(0.022, 0.008, 0.028), dark, 0, -0.084, -0.012);
    const guard = new THREE.TorusGeometry(0.013, 0.0024, 5, 8, Math.PI);
    guard.rotateX(Math.PI);
    add(guard, dark, 0, -0.004, 0.018);
    g.visible = false;
    return g;
  }

  function makeFlash() {
    const mat = new THREE.MeshBasicNodeMaterial({ color: 0xffe3a1, transparent: true, opacity: 0.92, depthWrite: false });
    const geo = new THREE.ConeGeometry(0.03, 0.09, 6);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.026, 0.2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  function makeHud() {
    cross = document.createElement('div');
    cross.id = 'pistol-crosshair';
    cross.hidden = true;
    cross.innerHTML = '<i></i><i></i><i></i><i></i>';
    hud = document.createElement('div');
    hud.id = 'pistol-ammo';
    hud.hidden = true;
    document.body.append(cross, hud);
  }

  function audio() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  function burst(ctx, seconds, freq, q) {
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + seconds);
  }

  function gunshot() {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    burst(ctx, 0.14, 720, 0.7);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  function dryFire() {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'square';
    osc.frequency.value = 210;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  function hudText() {
    if (!state.equipped || !onFoot()) {
      hud.hidden = true;
      cross.hidden = true;
      return;
    }
    hud.hidden = false;
    const inf = '∞';
    if (state.reloadLeft > 0) hud.textContent = `PISTOL  ${state.ammo} / ${inf}`;
    else if (state.ammo <= 0) hud.textContent = `PISTOL  0 / ${inf} — PRESS R TO RELOAD`;
    else hud.textContent = `PISTOL  ${state.ammo} / ${inf}`;
    cross.hidden = !(state.equipped && onFoot());
  }

  function setEquipped(on, silent) {
    const was = state.equipped;
    state.equipped = on;
    if (!on) state.reloadLeft = 0;
    if (!silent && was !== on) {
      emit('weapon:equipped', {
        actor: 'player',
        weapon: 'pistol',
        equipped: on,
        position: playerPos(),
        timestamp: Date.now()
      });
    }
  }

  function playerPos() {
    const p = cm?.entities?.person?.position;
    return p ? { x: p.x, y: p.y, z: p.z } : null;
  }

  function toggle() {
    setEquipped(!state.equipped);
  }

  function startReload() {
    if (!state.equipped || state.reloadLeft > 0 || state.ammo >= MAG) return;
    state.reloadLeft = RELOAD;
  }

  function canShoot() {
    return state.equipped && onFoot() && followCam() && state.reloadLeft <= 0 && !blocked({}) && !window.CITY.cameoTalk && !window.CITY.uiOverlay;
  }

  function tryFire() {
    if (!canShoot()) return;
    const now = performance.now() / 1000;
    if (now - state.lastShot < FIRE_GAP) return;
    if (state.ammo <= 0) {
      state.lastShot = now;
      dryFire();
      return;
    }
    state.ammo -= 1;
    state.lastShot = now;
    state.recoil = 1;
    flash.visible = true;
    flash.userData.until = now + 0.045;
    gunshot();
    const hit = shoot();
    emit('weapon:fired', {
      actor: 'player',
      weapon: 'pistol',
      targetId: hit.targetId,
      targetCategory: hit.targetCategory,
      position: { x: hit.x, y: hit.y, z: hit.z },
      timestamp: Date.now(),
      damage: hit.damage,
      ammo: state.ammo
    });
  }

  function raySegment(ox, oz, dx, dz, ax, az, bx, bz) {
    const ex = bx - ax;
    const ez = bz - az;
    const det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-8) return null;
    const t = ((ax - ox) * ez - (az - oz) * ex) / det;
    const u = ((ax - ox) * dz - (az - oz) * dx) / det;
    if (t < 0 || u < 0 || u > 1) return null;
    return t;
  }

  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const vx = ox - cx;
    const vy = oy - cy;
    const vz = oz - cz;
    const b = vx * dx + vy * dy + vz * dz;
    const c = vx * vx + vy * vy + vz * vz - r * r;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t > 0 ? t : Infinity;
  }

  function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, radius) {
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const abLen = Math.hypot(abx, aby, abz) || 1e-6;
    const ux = abx / abLen;
    const uy = aby / abLen;
    const uz = abz / abLen;
    const vx = ox - ax;
    const vy = oy - ay;
    const vz = oz - az;
    const dDot = dx * ux + dy * uy + dz * uz;
    const oDot = vx * ux + vy * uy + vz * uz;
    const rx = dx - ux * dDot;
    const ry = dy - uy * dDot;
    const rz = dz - uz * dDot;
    const sx = vx - ux * oDot;
    const sy = vy - uy * oDot;
    const sz = vz - uz * oDot;
    const A = rx * rx + ry * ry + rz * rz;
    const B = 2 * (sx * rx + sy * ry + sz * rz);
    const C = sx * sx + sy * sy + sz * sz - radius * radius;
    let best = Infinity;
    if (A > 1e-8) {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const t = (-B - Math.sqrt(disc)) / (2 * A);
        const along = oDot + dDot * t;
        if (t > 0.05 && along >= 0 && along <= abLen) best = t;
      }
    }
    best = Math.min(best, raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, radius));
    best = Math.min(best, raySphere(ox, oy, oz, dx, dy, dz, bx, by, bz, radius));
    return best;
  }

  function colliderHit(ox, oy, oz, dx, dy, dz, maxT) {
    const G = window.CITY.WorldCollision;
    if (!G || !cm.nearColliders) return null;
    const seen = new Set();
    let best = null;
    const samples = 8;
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * maxT;
      const list = cm.nearColliders(ox + dx * t, oz + dz * t, maxT / samples + 6);
      for (const c of list) {
        if (seen.has(c)) continue;
        seen.add(c);
        if ((c.maxX - c.minX) > 90 || (c.maxZ - c.minZ) > 90) continue;
        const shape = G.colliderShape(c);
        if (!shape.edges.length) continue;
        const minY = c.minY ?? -2;
        const maxY = c.maxY ?? 400;
        const edges = shape.edges;
        for (let e = 0; e < edges.length; e++) {
          const edge = edges[e];
          const hitT = raySegment(ox, oz, dx, dz, edge.a.x, edge.a.z, edge.b.x, edge.b.z);
          if (hitT === null || hitT < 0.35 || hitT > maxT) continue;
          const y = oy + dy * hitT;
          if (y < minY - 0.05 || y > maxY + 0.05) continue;
          if (!best || hitT < best.t) best = { t: hitT, nx: edge.nx, nz: edge.nz };
        }
        if (Math.abs(dy) > 1e-4) {
          const capY = dy < 0 ? maxY : minY;
          const capT = (capY - oy) / dy;
          if (capT > 0.35 && capT < maxT && G.inside(ox + dx * capT, oz + dz * capT, shape.points)) {
            if (!best || capT < best.t) best = { t: capT, nx: 0, nz: 0 };
          }
        }
      }
    }
    return best;
  }

  function capsuleOf(x, z, rig, radius) {
    const s = rig?.s || 1;
    const hip = rig?.placed && rig.pelvisY > 0.4 ? rig.pelvisY : 0.95 * s;
    const feet = hip - 0.82 * s;
    const head = feet + 1.72 * s;
    return { ax: x, ay: feet + 0.15, az: z, bx: x, by: head, bz: z, r: radius * s };
  }

  // Aim from the chest through the centre of the camera.  The old implementation
  // used the body's heading here, which meant the reticle and the shot diverged
  // as soon as the player dragged the chase camera around.
  function aimBasis() {
    const person = cm.entities.person;
    cameras.camera.getWorldDirection(camDir);
    camDir.normalize();
    cameras.camera.getWorldPosition(screenTarget);
    screenTarget.addScaledVector(camDir, RANGE);
    const ox = person.position.x;
    const oy = person.position.y + 1.42;
    const oz = person.position.z;
    camDir.set(screenTarget.x - ox, screenTarget.y - oy, screenTarget.z - oz).normalize();
    return {
      ox, oy, oz,
      dx: camDir.x,
      dy: camDir.y,
      dz: camDir.z,
      target: screenTarget
    };
  }

  function placeCrosshair() {
    if (!cross || !cameras?.camera || !cm?.entities?.person) return;
    cross.hidden = !(state.equipped && onFoot());
    if (cross.hidden) return;
    // The ray is deliberately camera-centred, so the reticle must stay centred
    // too.  Projecting the shoulder/chest point made it slide across the screen
    // whenever the camera was dragged.
    cross.style.visibility = 'visible';
    cross.style.display = 'block';
    cross.style.zIndex = '50';
    cross.style.left = `${window.innerWidth * 0.5}px`;
    cross.style.top = `${window.innerHeight * 0.5}px`;
  }

  function shoot() {
    const aim = aimBasis();
    // Converge the physical muzzle ray onto the exact world point under the
    // screen-centred reticle; camera-to-chest parallax no longer shifts hits.
    pistol.updateWorldMatrix(true, false);
    muzzle.copy(pistol.userData.muzzleLocal).applyMatrix4(pistol.matrixWorld);
    const ox = pistol.visible ? muzzle.x : aim.ox;
    const oy = pistol.visible ? muzzle.y : aim.oy;
    const oz = pistol.visible ? muzzle.z : aim.oz;
    const dx = aim.target.x - ox;
    const dy = aim.target.y - oy;
    const dz = aim.target.z - oz;
    const shotRange = Math.hypot(dx, dy, dz) || 1;
    const invLen = 1 / shotRange;
    const rayX = dx * invLen;
    const rayY = dy * invLen;
    const rayZ = dz * invLen;
    let bestT = shotRange;
    let kind = 'miss';
    let targetId = null;
    let targetCategory = null;
    let damage = 0;
    let normal = null;

    const wall = colliderHit(ox, oy, oz, rayX, rayY, rayZ, shotRange);
    if (wall) {
      bestT = wall.t;
      kind = 'world';
      normal = wall;
    }
    if (rayY < -0.04) {
      const groundY = (cm.entities.person.position.y || 0) + 0.04;
      const gt = (groundY - oy) / rayY;
      if (gt > 0.4 && gt < bestT) {
        bestT = gt;
        kind = 'world';
        normal = { nx: 0, nz: 0 };
      }
    }

    const peds = traffic?.peds || [];
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i];
      if (!p.placed || p.dead) continue;
      const rough = (p.x - ox) * rayX + (p.z - oz) * rayZ;
      if (rough < 0 || rough > bestT + 1) continue;
      if ((p.x - ox) ** 2 + (p.z - oz) ** 2 > (bestT + 2) ** 2) continue;
      const cap = capsuleOf(p.x, p.z, p.rig, 0.36);
      const t = rayCapsule(ox, oy, oz, rayX, rayY, rayZ, cap.ax, cap.ay, cap.az, cap.bx, cap.by, cap.bz, cap.r);
      if (t < bestT) {
        bestT = t;
        kind = 'ambient';
        targetId = p.id;
        targetCategory = 'ambient';
        damage = DAMAGE;
        p._shot = p;
      }
    }

    const cops = window.CITY.wanted?.targets || [];
    for (let i = 0; i < cops.length; i++) {
      const c = cops[i];
      if (!c.alive) continue;
      const rough = (c.x - ox) * rayX + (c.z - oz) * rayZ;
      if (rough < 0 || rough > bestT + 1) continue;
      const cap = capsuleOf(c.x, c.z, c.rig, 0.38);
      const t = rayCapsule(ox, oy, oz, rayX, rayY, rayZ, cap.ax, cap.ay, cap.az, cap.bx, cap.by, cap.bz, cap.r);
      if (t < bestT) {
        bestT = t;
        kind = 'police';
        targetId = c.id;
        targetCategory = 'police';
        damage = DAMAGE;
      }
    }

    const cast = window.CITY.CHARACTERS || [];
    for (const c of cast) {
      if (!c.npc || !c.rig) continue;
      const rough = (c.npc.x - ox) * rayX + (c.npc.z - oz) * rayZ;
      if (rough < 0 || rough > bestT + 1) continue;
      const cap = capsuleOf(c.npc.x, c.npc.z, c.rig, 0.4);
      const t = rayCapsule(ox, oy, oz, rayX, rayY, rayZ, cap.ax, cap.ay, cap.az, cap.bx, cap.by, cap.bz, cap.r);
      if (t < bestT) {
        bestT = t;
        kind = 'protected';
        targetId = c.id;
        targetCategory = c.combatRole || 'protected';
        damage = 0;
      }
    }

    const x = ox + rayX * bestT;
    const y = oy + rayY * bestT;
    const z = oz + rayZ * bestT;
    if (kind !== 'miss') spark(x, y, z, normal);
    tracer(x, y, z);

    if (kind === 'ambient') {
      const ped = peds.find((p) => p.id === targetId);
      const result = ped && traffic.hurtPedestrian ? traffic.hurtPedestrian(ped, DAMAGE, { x: rayX, z: rayZ }) : null;
      const base = {
        actor: 'player',
        targetId,
        targetCategory: 'ambient',
        position: { x, y, z },
        timestamp: Date.now(),
        damage: DAMAGE,
        weapon: 'pistol'
      };
      if (result === 'killed') emit('npc:killed', base);
      else if (result === 'damaged') emit('npc:damaged', { ...base, health: ped.health });
    } else if (kind === 'police') {
      const result = window.CITY.wanted?.damageOfficer(targetId, DAMAGE, { x: rayX, z: rayZ });
      const base = {
        actor: 'player',
        targetId,
        targetCategory: 'police',
        position: { x, y, z },
        timestamp: Date.now(),
        damage: DAMAGE,
        weapon: 'pistol'
      };
      if (result === 'killed') emit('npc:killed', base);
      else if (result === 'damaged') emit('npc:damaged', base);
    }

    return { x, y, z, targetId, targetCategory, damage, kind };
  }

  function spark(x, y, z, normal) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const p = pool[(state.sparkCursor = (state.sparkCursor + 1) % pool.length)];
      p.visible = true;
      p.position.set(x, y, z);
      const nx = normal?.nx || 0;
      const nz = normal?.nz || 0;
      p.userData.vx = nx * 1.6 + (Math.random() - 0.5) * 1.8;
      p.userData.vy = 1.4 + Math.random() * 1.6;
      p.userData.vz = nz * 1.6 + (Math.random() - 0.5) * 1.8;
      p.userData.life = 0.22 + Math.random() * 0.12;
    }
  }

  function tracer(x, y, z) {
    pistol.updateWorldMatrix(true, false);
    muzzle.copy(pistol.userData.muzzleLocal).applyMatrix4(pistol.matrixWorld);
    const t = tracers[state.tracerCursor = (state.tracerCursor + 1) % tracers.length];
    const len = Math.max(0.05, muzzle.distanceTo(aimPoint.set(x, y, z)));
    t.position.copy(muzzle).add(aimPoint).multiplyScalar(0.5);
    t.scale.set(0.012, 0.012, len);
    t.quaternion.setFromUnitVectors(zAxis, aimPoint.sub(muzzle).normalize());
    t.visible = true;
    t.userData.life = 0.04;
  }

  function poseArm(aim, reloadBlend, recoil, leftArm = false, target = null) {
    const rig = cm.entities.person.rig;
    const bones = BONE();
    if (!rig || !bones || !rig.placed) return null;
    const upperBone = leftArm ? bones.UPPER_ARM_L : bones.UPPER_ARM_R;
    const foreBone = leftArm ? bones.FOREARM_L : bones.FOREARM_R;
    rig.jointAt(upperBone, shoulder);
    const yaw = Math.atan2(aim.x, aim.z);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const s = rig.s;
    // Keep a visible elbow bend instead of locking the arm straight at full reach.
    let reach = 0.43 * s;
    let drop = 0.02 * s;
    if (reloadBlend > 0) {
      reach = (0.43 - 0.19 * reloadBlend) * s;
      drop = 0.2 * reloadBlend * s;
    }
    const flat = camDir.copy(aim);
    flat.y = 0;
    if (flat.lengthSq() < 1e-4) flat.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw));
    flat.normalize();
    if (target) hand.copy(target);
    else {
      hand.copy(shoulder).addScaledVector(flat, reach).addScaledVector(aim, 0.08 * s * (1 - reloadBlend));
      hand.addScaledVector(right, 0.07 * s);
      hand.y -= drop + recoil * 0.05;
      hand.addScaledVector(flat, -recoil * 0.07);
    }

    const l1 = 0.3 * s;
    const l2 = 0.255 * s;
    axis.subVectors(hand, shoulder);
    let dist = axis.length();
    axis.multiplyScalar(1 / (dist || 1));
    dist = Math.max(Math.abs(l1 - l2) + 0.01, Math.min((l1 + l2) * 0.992, dist));
    pole.copy(right).multiplyScalar(leftArm ? -0.9 : 0.9).addScaledVector(up, -0.35);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.lengthSq() < 1e-6) pole.copy(right);
    pole.normalize();
    const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    elbow.copy(shoulder).addScaledVector(axis, l1 * cosA).addScaledVector(pole, l1 * sinA);
    wrist.copy(shoulder).addScaledVector(axis, dist);
    front.copy(flat);
    rig.basis(axis.copy(shoulder).sub(elbow), front, q1);
    rig.writeBone(upperBone, q1, shoulder);
    rig.basis(axis.copy(elbow).sub(wrist), front, q2);
    rig.writeBone(foreBone, q2, elbow);
    return wrist;
  }

  function placeGun(at, aim) {
    const along = camDir.copy(aim);
    if (along.lengthSq() < 1e-6) along.set(0, 0, 1);
    along.normalize();
    pistol.position.copy(at).addScaledVector(along, 0.09);
    gunUp.set(0, 1, 0).addScaledVector(along, -along.y);
    if (gunUp.lengthSq() < 1e-4) gunUp.set(0, 0, 1);
    gunUp.normalize();
    right.crossVectors(gunUp, along).normalize();
    gunUp.crossVectors(along, right).normalize();
    basis.makeBasis(right, gunUp, along);
    qGun.setFromRotationMatrix(basis);
    if (state.recoil > 0) q1.setFromAxisAngle(right, -state.recoil * 0.45);
    else q1.identity();
    pistol.quaternion.copy(qGun).multiply(q1);
    pistol.position.addScaledVector(along, -state.recoil * 0.035);
    pistol.visible = true;
  }

  function hangGun() {
    const rig = cm.entities.person.rig;
    const bones = BONE();
    if (!rig?.placed || !bones) {
      pistol.visible = false;
      return;
    }
    rig.jointAt(bones.FOREARM_R, elbow);
    rig.jointAt(bones.UPPER_ARM_R, shoulder);
    axis.subVectors(elbow, shoulder);
    if (axis.lengthSq() < 1e-6) axis.set(0, -1, 0);
    axis.normalize();
    wrist.copy(elbow).addScaledVector(axis, 0.255 * rig.s);
    placeGun(wrist, axis);
  }

  function stepEffects(dt) {
    const now = performance.now() / 1000;
    if (flash.userData.until && now > flash.userData.until) flash.visible = false;
    for (const p of pool) {
      if (!p.visible) continue;
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        p.visible = false;
        continue;
      }
      p.userData.vy -= 9 * dt;
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      const k = Math.max(0.2, p.userData.life / 0.3);
      p.scale.setScalar(k);
    }
    for (const t of tracers) {
      if (!t.visible) continue;
      t.userData.life -= dt;
      t.visible = t.userData.life > 0;
    }
  }

  function onKey(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (blocked(e)) return;
    if (e.code === 'Digit1' && onFoot()) {
      toggle();
      e.preventDefault();
    } else if (e.code === 'KeyR' && state.equipped && onFoot()) {
      e.preventDefault();
      e.stopPropagation();
      startReload();
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0 || state.trigger) return;
    if (e.target !== canvas) return;
    if (blocked(e)) return;
    state.trigger = true;
    tryFire();
  }

  function onPointerUp(e) {
    if (e.button === 0) state.trigger = false;
  }

  function mount(ctx) {
    if (state.mounted) return;
    state.mounted = true;
    scene = ctx.scene;
    cm = ctx.controllerManager;
    cameras = ctx.cameraSystem;
    traffic = ctx.trafficSystem;
    canvas = cameras.domElement;
    pistol = makePistol();
    pistol.userData.muzzleLocal = new THREE.Vector3(0, 0.026, 0.16);
    flash = makeFlash();
    pistol.add(flash);
    scene.add(pistol);
    const spec = new THREE.MeshBasicNodeMaterial({ color: 0xe7d2a4, transparent: true, opacity: 0.85, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), spec);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      pool.push(m);
    }
    const tracerMat = new THREE.MeshBasicNodeMaterial({ color: 0xffe7b0, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tracerMat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      tracers.push(m);
    }
    state.sparkCursor = 0;
    state.tracerCursor = 0;
    makeHud();
    window.addEventListener('keydown', onKey, true);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('lostpointercapture', onPointerUp);
    window.addEventListener('blur', () => { state.trigger = false; });
  }

  function preUpdate() {
    const person = cm?.entities?.person;
    if (!person) return;
    const foot = onFoot();
    if (!foot) {
      if (state.equipped) {
        state.remembered = true;
        setEquipped(false, true);
      }
      state.reloadLeft = 0;
      person.combatAim = false;
      person.aimShoulder = 0;
      return;
    }
    if (state.remembered) {
      state.remembered = false;
      setEquipped(true);
    }
    const aiming = state.equipped && followCam() && cameras.aimZoom && !window.CITY.cameoTalk && !window.CITY.uiOverlay;
    person.combatAim = aiming;
    person.aimShoulder = aiming && cameras.activePresetId === 'chase' ? 0.62 : 0;
    if (aiming && (cameras.activePresetId === 'chase' || cameras.activePresetId === 'action' || cameras.activePresetId === 'pov')) {
      // The camera yaw is relative to the player's yaw. Steering toward the
      // camera's world direction while retaining a non-zero orbit offset creates
      // a feedback loop: every turn moves the target by that same offset, so the
      // player spins indefinitely. Consume any existing orbit offset once.
      if (Number.isFinite(cameras.orbitYawOffset) && Math.abs(cameras.orbitYawOffset) > 1e-6) {
        person.heading += cameras.orbitYawOffset;
        cameras.orbitYawOffset = 0;
      }
      person.aimHeading = person.heading;
    }
  }

  function postUpdate(dt) {
    if (!state.mounted) return;
    if (state.reloadLeft > 0) {
      state.reloadLeft -= dt;
      if (state.reloadLeft <= 0) {
        state.reloadLeft = 0;
        state.ammo = MAG;
        emit('weapon:reloaded', {
          actor: 'player',
          weapon: 'pistol',
          magazine: MAG,
          position: playerPos(),
          timestamp: Date.now()
        });
      }
    }
    state.recoil = Math.max(0, state.recoil - dt * 7.5);
    const show = state.equipped && onFoot();
    if (!show) {
      pistol.visible = false;
      flash.visible = false;
      hudText();
      stepEffects(dt);
      return;
    }
    const aiming = cm.entities.person.combatAim && followCam();
    if (aiming) {
      const aim = aimBasis();
      dir.set(aim.dx, aim.dy, aim.dz);
      const reloadBlend = state.reloadLeft > 0 ? Math.sin(Math.min(1, (RELOAD - state.reloadLeft) / RELOAD) * Math.PI) : 0;
      const at = poseArm(dir, reloadBlend, state.recoil);
      if (at) {
        gunWrist.copy(at);
        placeGun(gunWrist, dir);
        // Bring the left hand across as a support hand so the pistol reads as
        // a deliberate two-handed aim rather than a detached, straight arm.
        camDir.copy(dir);
        camDir.y = 0;
        if (camDir.lengthSq() > 1e-6) camDir.normalize();
        supportTarget.copy(pistol.position).addScaledVector(right, 0.09).addScaledVector(camDir, -0.055).addScaledVector(up, -0.025);
        poseArm(dir, reloadBlend, 0, true, supportTarget);
      }
      else pistol.visible = false;
    } else hangGun();
    hudText();
    placeCrosshair();
    stepEffects(dt);
  }

  window.CITY.combat = {
    mount,
    preUpdate,
    postUpdate,
    get equipped() { return state.equipped; },
    get ammo() { return state.ammo; },
    get reloading() { return state.reloadLeft > 0; },
    get magazineSize() { return MAG; },
    get damage() { return DAMAGE; }
  };
})();
