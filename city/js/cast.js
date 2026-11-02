// Rigged, textured hero/cameo characters. The procedural PersonRig remains the
// collision/combat authority and a deliberate fallback when an asset cannot load.
(function () {
  const { THREE, Addons } = window.CITY;
  const recipes = window.CITY.castRecipes;
  if (!THREE || !Addons?.GLTFLoader || !Addons?.cloneSkinned || !recipes) return;

  const ASSETS = {
    body: './assets/characters/_src/readyplayer.me.glb',
    faces: {
      cj: './assets/characters/generated/cj-face-uv.png',
      drake: './assets/characters/generated/drake-face-uv.png',
      tobi: './assets/characters/generated/tobi-face-uv.png',
      sam: './assets/characters/generated/sam-face-uv.png',
      jensen: './assets/characters/generated/jensen-face-uv.png',
      hinton: './assets/characters/generated/hinton-face-uv.png',
      chow: './assets/characters/generated/olivia-chow-face-uv.png',
      kawhi: './assets/characters/generated/kawhi-face-uv.png'
    },
    clips: {
      idle: './assets/characters/anim/M_Standing_Idle_001.glb',
      walk: './assets/characters/anim/M_Walk_001.glb',
      run: './assets/characters/anim/M_Run_001.glb',
      jump: './assets/characters/anim/M_Walk_Jump_001.glb'
    }
  };
  const loader = new Addons.GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const gltfCache = new Map();
  const textureCache = new Map();
  let libraryPromise = null;

  function load(url) {
    if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url));
    return gltfCache.get(url);
  }

  function loadFace(id) {
    const url = ASSETS.faces[id];
    if (!url) return Promise.resolve(null);
    if (!textureCache.has(url)) {
      textureCache.set(url, textureLoader.loadAsync(url).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        return texture;
      }));
    }
    return textureCache.get(url);
  }

  function cleanClip(source, name) {
    const clip = source.clone();
    clip.name = name;
    // RPM locomotion is authored with forward root motion. Gameplay already moves
    // the capsule, so pin horizontal hip translation while preserving vertical bob.
    for (const track of clip.tracks) {
      if (!/(^|\.)Hips\.position$/.test(track.name)) continue;
      const firstX = track.values[0];
      const firstZ = track.values[2];
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = firstX;
        track.values[i + 2] = firstZ;
      }
    }
    clip.resetDuration();
    return clip;
  }

  function library() {
    if (!libraryPromise) {
      libraryPromise = Promise.all([
        load(ASSETS.body),
        ...Object.entries(ASSETS.clips).map(async ([name, url]) => {
          const gltf = await load(url);
          if (!gltf.animations?.[0]) throw new Error(`Character clip has no animation: ${url}`);
          return [name, cleanClip(gltf.animations[0], name)];
        })
      ]).then(([body, ...clips]) => ({ body, clips: Object.fromEntries(clips) }));
    }
    return libraryPromise;
  }

  function materialCopy(material, color, roughness, metalness) {
    const copy = material.clone();
    if (color && copy.color) copy.color.set(color);
    if (Number.isFinite(roughness)) copy.roughness = roughness;
    if (Number.isFinite(metalness)) copy.metalness = metalness;
    copy.needsUpdate = true;
    return copy;
  }

  function tintTextured(material, hex) {
    const copy = material.clone();
    const scale = recipes.skinScale(hex);
    if (copy.color) copy.color.setRGB(scale[0], scale[1], scale[2]);
    copy.roughness = Math.max(0.68, copy.roughness || 0.72);
    copy.metalness = 0;
    copy.needsUpdate = true;
    return copy;
  }

  function find(root, name) {
    return root.getObjectByName(name) || null;
  }

  function filteredGeometry(source, keepTriangle) {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    if (!position) return null;
    const keep = [];
    for (let i = 0; i + 2 < position.count; i += 3) {
      if (keepTriangle(i, position, normal, skinIndex, skinWeight)) keep.push(i, i + 1, i + 2);
    }
    if (!keep.length) return null;
    const result = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geometry.attributes)) {
      const ArrayType = attr.array.constructor;
      const values = new ArrayType(keep.length * attr.itemSize);
      for (let out = 0; out < keep.length; out++) {
        const src = keep[out] * attr.itemSize;
        for (let c = 0; c < attr.itemSize; c++) values[out * attr.itemSize + c] = attr.array[src + c];
      }
      result.setAttribute(name, new THREE.BufferAttribute(values, attr.itemSize, attr.normalized));
    }
    result.computeBoundingBox();
    result.computeBoundingSphere();
    geometry.dispose();
    return result;
  }

  function skinnedOverlay(source, geometry, material, scale = 1.005) {
    if (!source?.isSkinnedMesh || !geometry) return null;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = `${source.name}_overlay`;
    mesh.bind(source.skeleton, source.bindMatrix);
    mesh.bindMode = source.bindMode;
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    source.parent.add(mesh);
    return mesh;
  }

  function makeHair(head, look) {
    if (!head?.isSkinnedMesh || look.hairStyle === 'bald') return null;
    const geometry = filteredGeometry(head.geometry, (i, p, n) => {
      let hits = 0;
      for (let v = 0; v < 3; v++) {
        const k = i + v;
        if (recipes.hairVertex(p.getY(k), p.getZ(k), n ? n.getY(k) : 0, look.hairStyle)) hits++;
      }
      return hits >= 2;
    });
    return skinnedOverlay(head, geometry,
      new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.88, metalness: 0 }),
      look.hairStyle === 'buzz' ? 1.006 : 1.014);
  }

  function makeBob(headBone, color) {
    if (!headBone) return null;
    const group = new THREE.Group();
    group.name = 'AttachedBobHair';
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.72), material);
    cap.scale.set(1.05, 0.92, 1.04);
    cap.position.y = 0.13;
    group.add(cap);
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.13, 5, 10), material);
      panel.position.set(side * 0.098, 0.035, -0.006);
      panel.rotation.z = side * 0.08;
      group.add(panel);
    }
    for (const x of [-0.06, -0.03, 0, 0.03, 0.06]) {
      const fringe = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.055 + Math.abs(x) * 0.25, 3, 7), material);
      fringe.position.set(x, 0.12 - Math.abs(x) * 0.25, 0.105);
      fringe.rotation.z = -x * 2.4;
      group.add(fringe);
    }
    group.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
    headBone.add(group);
    return group;
  }

  function makeBraids(headBone, color) {
    if (!headBone) return null;
    const group = new THREE.Group();
    group.name = 'AttachedBraids';
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 });
    const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.111, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), material);
    scalp.scale.set(1, 0.78, 1.02);
    scalp.position.y = 0.145;
    group.add(scalp);
    const braidPositions = [
      [-0.09, 0.03, -0.005, -0.12], [-0.065, 0.015, -0.065, -0.08], [-0.035, 0.02, -0.09, -0.04],
      [0.035, 0.02, -0.09, 0.04], [0.065, 0.015, -0.065, 0.08], [0.09, 0.03, -0.005, 0.12]
    ];
    for (const [x, y, z, rz] of braidPositions) {
      const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.13, 5, 7), material);
      braid.position.set(x, y, z);
      braid.rotation.z = rz;
      group.add(braid);
    }
    group.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
    headBone.add(group);
    return group;
  }

  function makeTank(body, look) {
    if (!body?.isSkinnedMesh) return null;
    const spine = new Set();
    body.skeleton.bones.forEach((bone, i) => {
      if (/^Spine/.test(bone.name)) spine.add(i);
    });
    const geometry = filteredGeometry(body.geometry, (i, p, _n, indices, weights) => {
      let hits = 0;
      for (let v = 0; v < 3; v++) {
        const k = i + v;
        let torsoWeight = 0;
        if (indices && weights) {
          for (let c = 0; c < indices.itemSize; c++) {
            if (spine.has(indices.getComponent(k, c))) torsoWeight += weights.getComponent(k, c);
          }
        }
        if (recipes.tankVertex(p.getX(k), p.getY(k), p.getZ(k), torsoWeight)) hits++;
      }
      return hits >= 2;
    });
    return skinnedOverlay(body, geometry,
      new THREE.MeshStandardMaterial({ color: look.tank, roughness: 0.94, metalness: 0 }), 1.012);
  }

  function roundedFrame(width, height, depth, material) {
    const shape = new THREE.Shape();
    const x = width / 2, y = height / 2, r = Math.min(width, height) * 0.22;
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const hole = new THREE.Path();
    const inset = 0.008;
    hole.moveTo(-x + r + inset, -y + inset);
    hole.lineTo(x - r - inset, -y + inset);
    hole.quadraticCurveTo(x - inset, -y + inset, x - inset, -y + r);
    hole.lineTo(x - inset, y - r); hole.quadraticCurveTo(x - inset, y - inset, x - r, y - inset);
    hole.lineTo(-x + r, y - inset); hole.quadraticCurveTo(-x + inset, y - inset, -x + inset, y - r);
    hole.lineTo(-x + inset, -y + r); hole.quadraticCurveTo(-x + inset, -y + inset, -x + r + inset, -y + inset);
    shape.holes.push(hole);
    return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 }), material);
  }

  function makeGlasses(headBone, scale = 0.82) {
    if (!headBone) return null;
    const group = new THREE.Group();
    group.name = 'AttachedGlasses';
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x242526, roughness: 0.5, metalness: 0.25 });
    const lensMaterial = new THREE.MeshPhysicalMaterial({ color: 0xbdd6dc, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0 });
    for (const side of [-1, 1]) {
      const frame = roundedFrame(0.062, 0.042, 0.006, frameMaterial);
      frame.position.set(side * 0.035, 0, 0);
      group.add(frame);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.028), lensMaterial);
      lens.position.set(side * 0.035, 0, 0.007);
      group.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.006), frameMaterial);
    bridge.position.z = 0.003;
    group.add(bridge);
    group.position.set(0, 0.055, 0.105);
    group.scale.setScalar(scale);
    headBone.add(group);
    return group;
  }

  function makeFlatCap(headBone, color) {
    if (!headBone) return null;
    const group = new THREE.Group();
    group.name = 'AttachedFlatCap';
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.116, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), material);
    crown.scale.set(1.08, 0.52, 1.12);
    crown.position.y = 0.215;
    const brimShape = new THREE.Shape();
    brimShape.moveTo(-0.082, 0); brimShape.quadraticCurveTo(0, 0.105, 0.082, 0);
    brimShape.quadraticCurveTo(0, 0.042, -0.082, 0);
    const brim = new THREE.Mesh(new THREE.ExtrudeGeometry(brimShape, { depth: 0.009, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003 }), material);
    brim.rotation.x = Math.PI / 2 + 0.12;
    brim.position.set(0, 0.178, 0.062);
    group.add(crown, brim);
    headBone.add(group);
    return group;
  }

  function styleModel(root, look, faceTexture) {
    const head = find(root, 'Wolf3D_Head');
    const body = find(root, 'Wolf3D_Body');
    const beard = find(root, 'Wolf3D_Beard');
    const headwear = find(root, 'Wolf3D_Headwear');
    const top = find(root, 'Wolf3D_Outfit_Top');
    const bottom = find(root, 'Wolf3D_Outfit_Bottom');
    const shoes = find(root, 'Wolf3D_Outfit_Footwear');
    const headBone = find(root, 'Head');

    if (body?.material) body.material = tintTextured(body.material, look.skin);
    if (head?.material) {
      if (faceTexture) {
        head.material = head.material.clone();
        head.material.map = faceTexture;
        if (head.material.color) head.material.color.set(0xffffff);
        head.material.roughness = Math.max(0.72, head.material.roughness || 0.72);
        head.material.metalness = 0;
        head.material.needsUpdate = true;
      } else head.material = tintTextured(head.material, look.skin);
    }
    if (headwear) headwear.visible = false;
    if (beard) {
      beard.visible = look.beard > 0.08;
      beard.material = materialCopy(beard.material, look.hair, 0.94, 0);
      beard.scale.set(1 + look.beard * 0.025, 0.88 + look.beard * 0.14, 1 + look.beard * 0.04);
    }
    if (top) {
      // This RPM source's body mesh contains exposed extremities, not a complete
      // nude torso. Never hide the authored top unless a replacement clothing
      // mesh is present, or the head and hands appear detached in game.
      top.visible = true;
      top.material = materialCopy(top.material, look.top === 'tank' ? look.tank : look.jacket,
        look.top === 'tank' ? 0.94 : look.jacketRough,
        look.top === 'tank' ? 0 : look.jacketMetal);
      if (look.top === 'tank' && top.material?.emissive) {
        top.material.emissive.set(0x38362d);
        top.material.emissiveIntensity = 0.24;
      }
    }
    if (bottom) bottom.material = materialCopy(bottom.material, look.jeans, 0.88, 0);
    if (shoes) shoes.material = materialCopy(shoes.material, look.shoes, 0.72, 0.03);
    makeHair(head, look);
    if (look.hairStyle === 'bob') makeBob(headBone, look.hair);
    if (look.hairStyle === 'braids') makeBraids(headBone, look.hair);
    if (look.glasses) makeGlasses(headBone, look.glassesScale || 0.82);
    if (look.cap) makeFlatCap(headBone, look.capColor || '#292d32');
    if (Array.isArray(look.modelScale)) root.scale.multiply(new THREE.Vector3(...look.modelScale));
    if (headBone) {
      const faceScale = look.headScale || (look.older ? [0.98, 1.035, 1.015] : look.beard > 0.8 ? [1.035, 0.985, 1.02] : [1, 1, 1]);
      headBone.scale.multiply(new THREE.Vector3(...faceScale));
    }
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    });
  }

  class CastActor {
    constructor(id, options = {}) {
      this.id = id;
      this.look = recipes.LOOKS[id];
      this.root = new THREE.Group();
      this.root.name = `RiggedCast:${id}`;
      this.root.visible = false;
      this.ready = false;
      this.failed = false;
      this.current = '';
      this.actions = {};
      this.options = options;
      (options.parent || options.scene)?.add(this.root);
      this.promise = this.build();
    }

    async build() {
      if (!this.look) throw new Error(`Unknown cast look: ${this.id}`);
      try {
        const [lib, faceTexture] = await Promise.all([library(), loadFace(this.id)]);
        const model = Addons.cloneSkinned(lib.body.scene);
        model.name = `${this.id}:model`;
        styleModel(model, this.look, faceTexture);
        this.root.add(model);
        this.model = model;
        this.mixer = new THREE.AnimationMixer(model);
        for (const [name, clip] of Object.entries(lib.clips)) {
          const action = this.mixer.clipAction(clip);
          action.enabled = true;
          action.setEffectiveWeight(0);
          action.play();
          this.actions[name] = action;
        }
        this.bones = {
          head: find(model, 'Head'), spine: find(model, 'Spine2'),
          rightArm: find(model, 'RightArm'), rightForeArm: find(model, 'RightForeArm')
        };
        this.ready = true;
        this.root.visible = this.options.visible !== false;
        this.transition('idle', 0);
        this.options.onReady?.(this);
      } catch (error) {
        this.failed = true;
        this.root.visible = false;
        console.warn(`[cast] ${this.id} stayed on procedural fallback`, error);
        this.options.onError?.(error);
      }
      return this;
    }

    transition(name, duration = 0.22) {
      if (!this.ready || name === this.current || !this.actions[name]) return;
      const next = this.actions[name];
      next.enabled = true;
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);
      if (name === 'jump') next.reset();
      if (this.current && this.actions[this.current]) next.crossFadeFrom(this.actions[this.current], duration, true);
      else next.fadeIn(Math.max(0.001, duration));
      this.current = name;
    }

    update(dt, state = {}) {
      if (!this.ready || !this.mixer) return;
      const name = state.talking ? 'idle' : recipes.locomotionName(state.speed, state.airborne);
      this.transition(name);
      const action = this.actions[name];
      if (action) {
        const speed = Math.abs(Number(state.speed) || 0);
        const scale = name === 'walk' ? Math.max(0.72, speed / 4.4) : name === 'run' ? Math.max(0.8, speed / 8.2) : 1;
        action.setEffectiveTimeScale((state.speed < -0.25 ? -1 : 1) * scale);
      }
      this.mixer.update(Math.min(0.05, Math.max(0, dt || 0)));
      const t = performance.now() * 0.001;
      if (state.talking) {
        if (this.bones.head) this.bones.head.rotation.y += Math.sin(t * 1.7) * 0.055;
        if (this.bones.spine) this.bones.spine.rotation.z += Math.sin(t * 2.1) * 0.025;
        if (this.bones.rightArm) this.bones.rightArm.rotation.z += 0.18 + Math.sin(t * 2.4) * 0.11;
      }
      if (state.aiming) {
        if (this.bones.spine) this.bones.spine.rotation.x -= 0.12;
        if (this.bones.rightArm) {
          this.bones.rightArm.rotation.x -= 1.05;
          this.bones.rightArm.rotation.z -= 0.34;
        }
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.x -= 0.5;
      }
      if (state.reloading && this.bones.rightForeArm) this.bones.rightForeArm.rotation.z += 0.75;
    }

    setTransform(x, y, z, yaw) {
      this.root.position.set(x, y || 0, z);
      this.root.rotation.y = yaw || 0;
    }

    setVisible(visible) {
      this.options.visible = visible;
      this.root.visible = !!visible && this.ready;
    }

    dispose() {
      this.mixer?.stopAllAction();
      this.root.removeFromParent();
    }
  }

  const actors = new Set();
  window.CITY.cast = {
    ASSETS,
    create(id, options) {
      const actor = new CastActor(id, options);
      actors.add(actor);
      return actor;
    },
    preload: library,
    actors,
    get stats() {
      let ready = 0, failed = 0;
      for (const actor of actors) { if (actor.ready) ready++; if (actor.failed) failed++; }
      return { total: actors.size, ready, failed, cachedAssets: gltfCache.size };
    }
  };
})();
