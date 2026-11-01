// Wanted level. Stars start at 0 and cap at 5. One ambient kill is one star.
// One responding cruiser per star. Officers step out and shoot. A cop kill is two stars.
// Dying flashes the wasted screen, then the player respawns on foot at a random spot.
(function () {
  const { THREE, PersonCrowd, PersonRig, PersonRagdoll, PERSON_BONES: BONES } = window.CITY;
  const MAX = 5;
  const COP_HP = 100;
  const PLAYER_HP = 100;
  const COP_DAMAGE = 18;
  const SHOT_GAP = 0.85;

  let scene, cm, traffic;
  let stars = 0;
  let down = false;
  let downLeft = 0;
  let playerHp = PLAYER_HP;
  let crowd = null;
  let mounted = false;
  const officers = [];
  let starEl, healthEl, fillEl, wastedEl;
  let siren = null;
  let audioCtx = null;

  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const yawAxis = new THREE.Vector3(0, 1, 0);

  function emitReady() {
    return window.CITY.events;
  }

  function paintStars() {
    if (!starEl) return;
    const bits = starEl.querySelectorAll('svg');
    bits.forEach((el, i) => el.classList.toggle('is-on', i < stars));
    starEl.dataset.level = String(stars);
  }

  function paintHealth() {
    if (!fillEl) return;
    const k = Math.max(0, Math.min(1, playerHp / PLAYER_HP));
    fillEl.style.transform = `scaleX(${k})`;
    healthEl.classList.toggle('is-low', k <= 0.35 && k > 0);
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(MAX, n | 0));
    paintStars();
    if (!down) traffic?.dispatchPolice?.(stars);
  }

  function onKilled(detail) {
    if (down || !detail) return;
    if (detail.targetCategory === 'protected') return;
    setStars(stars + (detail.targetCategory === 'police' ? 2 : 1));
  }

  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function blip() {
    const ctx = audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'square';
    osc.frequency.value = 140;
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  function sirenOn(on) {
    const ctx = on ? audio() : audioCtx;
    if (!ctx) return;
    if (!siren) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 640;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      siren = { osc, gain };
    }
    const t = ctx.currentTime;
    siren.osc.frequency.setTargetAtTime(on ? 640 + Math.sin(t * 3.4) * 220 : 640, t, 0.04);
    siren.gain.gain.setTargetAtTime(on ? 0.04 : 0, t, 0.1);
  }

  function losBlocked(ax, ay, az, bx, by, bz) {
    const G = window.CITY.WorldCollision;
    if (!G || !cm?.nearColliders) return false;
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      const list = cm.nearColliders(x, z, 3);
      for (let k = 0; k < list.length; k++) {
        const c = list[k];
        if (c.curb || (c.maxX - c.minX) > 80) continue;
        const minY = c.minY ?? 0;
        const maxY = c.maxY ?? 60;
        if (y < minY || y > maxY) continue;
        if (G.inside(x, z, G.colliderShape(c).points)) return true;
      }
    }
    return false;
  }

  function makeOfficer(car, index) {
    const yaw = car.yaw || 0;
    const rig = new PersonRig({ seed: 20 + index, scale: 1.02, girth: 1.08, hair: 0.08 });
    const x = car.x + Math.cos(yaw) * 2.3;
    const z = car.z - Math.sin(yaw) * 2.3;
    const y = car.y || 0.2;
    rig.reset(x, z, yaw, () => y);
    const navy = new THREE.MeshStandardNodeMaterial({ color: 0x1c2d66, roughness: 0.7, metalness: 0.08 });
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.22), navy);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 8), navy);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), new THREE.MeshStandardNodeMaterial({ color: 0x222226, metalness: 0.6, roughness: 0.4 }));
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicNodeMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, depthWrite: false })
    );
    flash.visible = false;
    gun.add(flash);
    scene.add(vest, cap, gun);
    const officer = {
      id: `cop-${index}-${Math.floor(performance.now())}`,
      alive: true,
      health: COP_HP,
      role: 'police',
      rig,
      x, z, y, yaw,
      vest, cap, gun, flash,
      nextShot: 0.4 + index * 0.15,
      deadFor: 0,
      car
    };
    car.pursuit.officer = officer.id;
    officers.push(officer);
    return officer;
  }

  function hideProps(o) {
    o.vest.visible = o.cap.visible = o.gun.visible = false;
  }

  function poseProps(o) {
    if (!o.alive) {
      hideProps(o);
      return;
    }
    o.rig.jointAt(BONES.CHEST, tmp);
    o.vest.position.set(tmp.x, tmp.y + 0.02, tmp.z);
    o.vest.quaternion.setFromAxisAngle(yawAxis, o.yaw);
    o.rig.jointAt(BONES.HEAD, tmp);
    o.cap.position.set(tmp.x, tmp.y + 0.14, tmp.z);
    o.cap.quaternion.copy(o.vest.quaternion);
    o.rig.jointAt(BONES.FOREARM_R, tmp);
    const person = cm.getActiveEntity();
    const aimX = person.position.x - tmp.x;
    const aimZ = person.position.z - tmp.z;
    o.gun.position.set(tmp.x, tmp.y, tmp.z);
    o.gun.quaternion.setFromAxisAngle(yawAxis, Math.atan2(aimX, aimZ));
    o.vest.visible = o.cap.visible = o.gun.visible = true;
  }

  function damageOfficer(id, amount, dir) {
    const o = officers.find((c) => c.id === id && c.alive);
    if (!o) return null;
    o.health -= amount;
    if (o.health > 0) return 'damaged';
    o.alive = false;
    o.deadFor = 0;
    hideProps(o);
    if (!o.rig.placed) o.rig.reset(o.x, o.z, o.yaw, () => o.y);
    o.rig.solve();
    o.rag = new PersonRagdoll();
    o.rag.start(o.rig, (dir?.x || 0) * 2.2, 1, (dir?.z || 0) * 2.2, (dir?.x || 0) * 0.4, (dir?.z || 0) * 0.4);
    return 'killed';
  }

  function damagePlayer(amount) {
    if (down) return;
    playerHp = Math.max(0, playerHp - amount);
    paintHealth();
    if (playerHp > 0) return;
    down = true;
    downLeft = 3.6;
    sirenOn(false);
    if (wastedEl) {
      wastedEl.hidden = false;
      wastedEl.classList.add('is-on');
    }
  }

  function respawnSomewhere() {
    const spots = Object.values(window.CITY.TELEPORT_LOCATIONS || {}).filter((s) => Number.isFinite(s?.x) && Number.isFinite(s?.z));
    if (!spots.length || !cm) return;
    const here = cm.getActiveEntity?.()?.position || cm.entities?.person?.position;
    const away = here ? spots.filter((s) => Math.hypot(s.x - here.x, s.z - here.z) > 150) : spots;
    const pool = away.length ? away : spots;
    const spot = pool[Math.floor(Math.random() * pool.length)];
    const heading = Number.isFinite(spot.heading) ? spot.heading : Math.random() * Math.PI * 2;
    const app = window.__CITY_APP;
    if (cm.activeMode !== 'person') app?.selectMode?.('person');
    if (app?.teleportTo) app.teleportTo(spot.x, spot.z, heading);
    else cm.teleportActiveTo(spot.x, spot.z, heading, null, true);
  }

  function clearDown() {
    down = false;
    downLeft = 0;
    playerHp = PLAYER_HP;
    paintHealth();
    traffic?.releasePolice?.();
    for (const o of officers) hideProps(o);
    officers.length = 0;
    setStars(0);
    const person = cm?.entities?.person;
    if (person) person.health = playerHp;
    respawnSomewhere();
    if (wastedEl) {
      wastedEl.classList.remove('is-on');
      wastedEl.hidden = true;
    }
  }

  function officerStep(o, dt, person) {
    const dx = person.position.x - o.x;
    const dz = person.position.z - o.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    o.yaw = Math.atan2(dx, dz);
    if (dist > 7) {
      const step = Math.min(dist - 6.5, 4.2 * dt);
      o.x += (dx / dist) * step;
      o.z += (dz / dist) * step;
    }
    o.y = person.position.y || o.y;
    o.rig.update(dt, o.x, o.z, o.yaw, () => o.y);
    o.nextShot -= dt;
    if (o.nextShot > 0 || dist > 28 || dist < 1.5) return;
    const ay = o.y + 1.45;
    const by = person.position.y + 1.35;
    if (losBlocked(o.x, ay, o.z, person.position.x, by, person.position.z)) {
      o.nextShot = 0.35;
      return;
    }
    o.nextShot = SHOT_GAP;
    o.flash.visible = true;
    o.flash.userData.until = performance.now() + 50;
    blip();
    damagePlayer(COP_DAMAGE);
  }

  function mount(ctx) {
    if (mounted) return;
    mounted = true;
    scene = ctx.scene;
    cm = ctx.controllerManager;
    traffic = ctx.trafficSystem;
    crowd = new PersonCrowd(MAX, { farDistance: 80, castShadow: true });
    crowd.meshes.forEach((m) => scene.add(m));

    starEl = document.createElement('div');
    starEl.id = 'wanted-stars';
    starEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.2 14.8 8.6 21.8 9.4 16.6 14.1 18.1 21 12 17.5 5.9 21 7.4 14.1 2.2 9.4 9.2 8.6Z"/></svg>'.repeat(MAX);
    healthEl = document.createElement('div');
    healthEl.id = 'wanted-health';
    healthEl.innerHTML = '<span></span>';
    fillEl = healthEl.querySelector('span');
    wastedEl = document.createElement('div');
    wastedEl.id = 'wasted';
    wastedEl.hidden = true;
    wastedEl.innerHTML = '<p>WASTED</p>';
    document.body.append(starEl, healthEl, wastedEl);
    paintStars();
    paintHealth();
    if (cm.entities?.person) cm.entities.person.health = PLAYER_HP;
    emitReady()?.on('npc:killed', onKilled);
  }

  function update(dt) {
    if (!mounted) return;
    if (down) {
      downLeft -= dt;
      sirenOn(false);
      if (downLeft <= 0) clearDown();
      crowd.begin();
      crowd.end();
      return;
    }
    const person = cm.getActiveEntity();
    const cars = traffic?.pursuitCars?.() || [];
    cars.forEach((car, i) => {
      if (car.pursuit?.phase === 'stop' && !car.pursuit.officer && officers.length < MAX) makeOfficer(car, i);
    });
    crowd.begin();
    for (let i = officers.length - 1; i >= 0; i--) {
      const o = officers[i];
      if (!o.alive) {
        o.deadFor += dt;
        if (o.rag && o.deadFor < 6) {
          o.rag.step(dt, () => o.y, null);
          o.rag.apply(o.rig);
          crowd.add(o.rig, 0);
        }
        if (o.deadFor >= 6) {
          hideProps(o);
          officers.splice(i, 1);
        }
        continue;
      }
      if (person) officerStep(o, dt, person);
      else o.rig.update(dt, o.x, o.z, o.yaw, () => o.y);
      poseProps(o);
      if (o.flash.userData.until && performance.now() > o.flash.userData.until) o.flash.visible = false;
      crowd.add(o.rig, 0);
    }
    crowd.end();
    sirenOn(stars > 0);
    const ent = cm.entities?.person;
    if (ent) ent.health = playerHp;
  }

  window.CITY.wanted = {
    mount,
    update,
    damageOfficer,
    setStars,
    get stars() { return stars; },
    get isDown() { return down; },
    get health() { return playerHp; },
    get targets() { return officers; }
  };
})();
