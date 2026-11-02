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

  function loadTexture(url, wrap) {
    if (!url) return Promise.resolve(null);
    const key = `${url}|${wrap}`;
    if (!textureCache.has(key)) {
      textureCache.set(key, textureLoader.loadAsync(url).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = texture.wrapT = wrap;
        texture.needsUpdate = true;
        return texture;
      }));
    }
    return textureCache.get(key);
  }

  function loadFace(id) {
    return loadTexture(ASSETS.faces[id], THREE.ClampToEdgeWrapping);
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
    // The shared body is a wedding outfit. Multiplying that albedo keeps the pink
    // suit on every character, so the outfit colour replaces the print.
    copy.map = null;
    copy.emissiveMap = null;
    if (copy.emissive) copy.emissive.set(0x000000);
    copy.emissiveIntensity = 0;
    if (color && copy.color) copy.color.set(color);
    if (Number.isFinite(roughness)) copy.roughness = roughness;
    if (Number.isFinite(metalness)) copy.metalness = metalness;
    copy.needsUpdate = true;
    return copy;
  }

  function faceMaterial(source, texture) {
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0,
      normalMap: source?.normalMap || null,
      roughnessMap: source?.roughnessMap || null
    });
    if (source?.normalScale && material.normalScale?.copy) material.normalScale.copy(source.normalScale);
    material.needsUpdate = true;
    return material;
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

  // Flat cap in Head-bone space. The scalp peaks at y 0.195, the eyes sit
  // near y 0.09, and the face points toward +Z. The crown wraps the skull
  // down to the brow; the brim is a short visor in front of the forehead.
  function makeFlatCap(headBone, wool) {
    const cloth = new THREE.MeshStandardMaterial({
      map: wool || null,
      color: wool ? 0xffffff : 0x4a4e54,
      roughness: 0.97,
      metalness: 0,
      side: THREE.DoubleSide
    });
    if (wool) {
      wool.wrapS = wool.wrapT = THREE.RepeatWrapping;
      wool.repeat.set(4, 3);
    }
    const group = new THREE.Group();
    group.name = 'TobiFlatCap';

    const crown = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.012, 0.100),
      new THREE.Vector2(0.038, 0.094),
      new THREE.Vector2(0.078, 0.078),
      new THREE.Vector2(0.104, 0.048),
      new THREE.Vector2(0.114, 0.016),
      new THREE.Vector2(0.110, -0.004)
    ], 40), cloth);
    crown.position.set(0, 0.122, 0.004);

    const visor = new THREE.Shape();
    visor.moveTo(-0.078, 0.0);
    visor.lineTo(-0.062, 0.052);
    visor.quadraticCurveTo(0, 0.078, 0.062, 0.052);
    visor.lineTo(0.078, 0.0);
    visor.lineTo(-0.078, 0.0);
    const brimGeo = new THREE.ExtrudeGeometry(visor, { depth: 0.007, bevelEnabled: false, curveSegments: 10 });
    brimGeo.rotateX(Math.PI / 2);
    brimGeo.translate(0, 0.004, 0.02);
    const brim = new THREE.Mesh(brimGeo, cloth);
    brim.position.set(0, 0.128, 0.07);
    brim.rotation.x = 0.08;

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.007, 8, 32), cloth);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.126, 0.006);

    const button = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), cloth);
    button.scale.set(1, 0.45, 1);
    button.position.set(0, 0.228, 0.004);

    group.add(crown, brim, band, button);
    headBone.add(group);
  }

  function paintedCloth(source, map, repeat) {
    const material = new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0,
      normalMap: source?.normalMap || null
    });
    if (source?.normalScale && material.normalScale?.copy) material.normalScale.copy(source.normalScale);
    if (repeat) map.repeat.set(repeat[0], repeat[1]);
    material.needsUpdate = true;
    return material;
  }

  function styleModel(root, look, faceTexture, extras = {}) {
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
      // A fresh material, not a clone of the compiled wedding skin. WebGPU builds
      // the colour node from the map that exists when the material is first used.
      head.material = faceTexture ? faceMaterial(head.material, faceTexture) : tintTextured(head.material, look.skin);
    }
    // The only headwear in this body is a cowboy hat, and it does not sit as
    // anyone's cap. Hair, beards, glasses, and hats live in the face texture.
    if (headwear) headwear.visible = false;
    if (beard) beard.visible = false;
    if (top) {
      // This RPM source's body mesh contains exposed extremities, not a complete
      // nude torso. Never hide the authored top unless a replacement clothing
      // mesh is present, or the head and hands appear detached in game.
      top.visible = true;
      top.material = extras.shirt
        ? paintedCloth(top.material, extras.shirt, look.shirtRepeat)
        : materialCopy(top.material, look.top === 'tank' ? look.tank : look.jacket,
          look.top === 'tank' ? 0.94 : look.jacketRough,
          look.top === 'tank' ? 0 : look.jacketMetal);
    }
    if (bottom) bottom.material = materialCopy(bottom.material, look.jeans, 0.88, 0);
    if (shoes) shoes.material = materialCopy(shoes.material, look.shoes, 0.72, 0.03);
    if (Array.isArray(look.modelScale)) root.scale.multiply(new THREE.Vector3(...look.modelScale));
    if (headBone) {
      const faceScale = look.headScale || (look.older ? [0.98, 1.035, 1.015] : look.beard > 0.8 ? [1.035, 0.985, 1.02] : [1, 1, 1]);
      headBone.scale.multiply(new THREE.Vector3(...faceScale));
      if (look.cap === 'flat') makeFlatCap(headBone, extras.cap);
    }
    if (extras.eye) {
      const eyeMaterial = new THREE.MeshStandardMaterial({
        map: extras.eye,
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0
      });
      for (const name of ['EyeLeft', 'EyeRight']) {
        const eye = find(root, name);
        if (eye) eye.material = eyeMaterial;
      }
    }
    if (look.smile || look.mouthOpen) {
      root.traverse((obj) => {
        const dict = obj.morphTargetDictionary;
        const weights = obj.morphTargetInfluences;
        if (!dict || !weights) return;
        if (dict.mouthSmile != null) weights[dict.mouthSmile] = look.smile || 0;
        if (dict.mouthOpen != null) weights[dict.mouthOpen] = look.mouthOpen || 0;
      });
    }
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    });
  }

  const _aim = new THREE.Vector3();
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _shoulder = new THREE.Vector3();
  const _elbow = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _hint = new THREE.Vector3();
  const _x = new THREE.Vector3();
  const _y = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _parentPos = new THREE.Vector3();
  const _parentQuat = new THREE.Quaternion();
  const _parentScale = new THREE.Vector3();
  const _worldQuat = new THREE.Quaternion();
  const _q = new THREE.Quaternion();
  const _basis = new THREE.Matrix4();

  function quatFromY(dir, hint, out) {
    _y.copy(dir);
    if (_y.lengthSq() < 1e-8) _y.set(0, 1, 0);
    _y.normalize();
    _x.crossVectors(hint, _y);
    if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).cross(_y);
    if (_x.lengthSq() < 1e-6) _x.set(0, 0, 1).cross(_y);
    _x.normalize();
    _z.crossVectors(_x, _y).normalize();
    _basis.makeBasis(_x, _y, _z);
    return out.setFromRotationMatrix(_basis);
  }

  function setWorldQuaternion(bone, worldQ) {
    bone.parent.updateWorldMatrix(true, false);
    _basis.copy(bone.parent.matrixWorld);
    _basis.elements[12] = _basis.elements[13] = _basis.elements[14] = 0;
    _parentQuat.setFromRotationMatrix(_basis);
    bone.quaternion.copy(_parentQuat.invert()).multiply(worldQ);
    bone.updateWorldMatrix(false, false);
  }

  function solveArm(upper, fore, hand, upperLen, foreLen, isRight, aim, right, forward, aiming, reload, recoil) {
    _shoulder.setFromMatrixPosition(upper.matrixWorld);
    upperLen = Math.max(0.05, upperLen);
    foreLen = Math.max(0.05, foreLen);
    const side = isRight ? 1 : -1;
    if (reload > 0.05) {
      _target.copy(_shoulder).addScaledVector(forward, 0.36).addScaledVector(right, 0.08 * side).addScaledVector(_up, 0.02);
    } else if (aiming) {
      _target.copy(_shoulder).addScaledVector(aim, isRight ? 0.52 : 0.34).addScaledVector(right, isRight ? 0.08 : 0.02);
      _target.addScaledVector(aim, -recoil * 0.06);
    } else {
      // Hip: the hand stays in front of the ribs. A target behind the chest
      // folds the forearm through the coat.
      _target.copy(_shoulder).addScaledVector(forward, 0.32).addScaledVector(right, 0.09 * side).addScaledVector(_up, -0.12);
    }
    const ahead = _target.clone().sub(_shoulder).dot(forward);
    if (ahead < 0.32) _target.addScaledVector(forward, 0.32 - ahead);
    _axis.subVectors(_target, _shoulder);
    let dist = _axis.length() || 1;
    _axis.multiplyScalar(1 / dist);
    const maxReach = (upperLen + foreLen) * 0.98;
    const minReach = Math.abs(upperLen - foreLen) + 0.04;
    dist = Math.max(minReach, Math.min(maxReach, dist));
    _target.copy(_shoulder).addScaledVector(_axis, dist);
    // Elbow out to the side and a little down, never behind the chest.
    _hint.copy(right).multiplyScalar(side).addScaledVector(_up, -0.35).addScaledVector(forward, 0.15);
    _hint.addScaledVector(_axis, -_hint.dot(_axis));
    if (_hint.lengthSq() < 1e-6) _hint.copy(right).multiplyScalar(side);
    _hint.normalize();
    const cosA = (upperLen * upperLen + dist * dist - foreLen * foreLen) / (2 * upperLen * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - Math.min(1, cosA * cosA)));
    _elbow.copy(_shoulder).addScaledVector(_axis, upperLen * Math.max(-1, Math.min(1, cosA))).addScaledVector(_hint, upperLen * sinA);
    if (_elbow.clone().sub(_shoulder).dot(forward) < 0) {
      _hint.negate();
      _elbow.copy(_shoulder).addScaledVector(_axis, upperLen * Math.max(-1, Math.min(1, cosA))).addScaledVector(_hint, upperLen * sinA);
    }
    quatFromY(_elbow.clone().sub(_shoulder), _hint, _worldQuat);
    setWorldQuaternion(upper, _worldQuat);
    quatFromY(_target.clone().sub(_elbow), _hint, _worldQuat);
    setWorldQuaternion(fore, _worldQuat);
    _y.copy(aiming || reload > 0.05 ? aim : forward);
    if (!aiming && reload <= 0.05) _y.addScaledVector(_up, -0.2);
    quatFromY(_y, _up, _worldQuat);
    if (recoil > 0 && isRight) {
      _q.setFromAxisAngle(right, -recoil * 0.28);
      _worldQuat.premultiply(_q);
    }
    setWorldQuaternion(hand, _worldQuat);
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
        const [lib, faceTexture, eyeTexture, shirtTexture, capTexture] = await Promise.all([
          library(),
          loadFace(this.id),
          loadTexture(this.look.eyeMap, THREE.ClampToEdgeWrapping),
          loadTexture(this.look.shirtMap, THREE.RepeatWrapping),
          loadTexture(this.look.capMap, THREE.RepeatWrapping)
        ]);
        const model = Addons.cloneSkinned(lib.body.scene);
        model.name = `${this.id}:model`;
        styleModel(model, this.look, faceTexture, { eye: eyeTexture, shirt: shirtTexture, cap: capTexture });
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
          rightArm: find(model, 'RightArm'), rightForeArm: find(model, 'RightForeArm'), rightHand: find(model, 'RightHand'),
          leftArm: find(model, 'LeftArm'), leftForeArm: find(model, 'LeftForeArm'), leftHand: find(model, 'LeftHand')
        };
        model.updateWorldMatrix(true, true);
        const span = (a, b) => a && b ? a.getWorldPosition(_shoulder).distanceTo(b.getWorldPosition(_target)) : 0.25;
        this.lengths = {
          rightUpper: span(this.bones.rightArm, this.bones.rightForeArm),
          rightFore: span(this.bones.rightForeArm, this.bones.rightHand),
          leftUpper: span(this.bones.leftArm, this.bones.leftForeArm),
          leftFore: span(this.bones.leftForeArm, this.bones.leftHand)
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
      if (state.talking && !state.armed) {
        if (this.bones.head) this.bones.head.rotation.y += Math.sin(t * 1.7) * 0.055;
        if (this.bones.spine) this.bones.spine.rotation.z += Math.sin(t * 2.1) * 0.025;
        if (this.bones.rightArm) this.bones.rightArm.rotation.z += 0.18 + Math.sin(t * 2.4) * 0.11;
      }
    }

    // Two-bone IK. RPM limbs point along local +Y. Called after the mixer so a
    // walk clip cannot swing the gun arm.
    poseWeapon(spec) {
      const bones = this.bones;
      if (!this.ready || !bones?.rightArm || !bones.rightForeArm || !bones.rightHand || !spec?.aimDir) return;
      if (spec.aiming && bones.spine) {
        const lean = _q.setFromAxisAngle(_x.set(1, 0, 0), -0.1);
        bones.spine.quaternion.multiply(lean);
      }
      // The actor sits inside the player root, which carries the heading. The
      // model's own yaw stays 0, so facing has to come from the world matrix.
      this.root.updateWorldMatrix(true, true);
      const e = this.root.matrixWorld.elements;
      _forward.set(e[8], 0, e[10]);
      _right.set(e[0], 0, e[2]);
      if (_forward.lengthSq() < 1e-6) {
        const yaw = this.root.rotation.y;
        _forward.set(Math.sin(yaw), 0, Math.cos(yaw));
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      }
      _forward.normalize();
      _right.y = 0;
      _right.normalize();
      _aim.copy(spec.aimDir);
      if (_aim.lengthSq() < 1e-6) _aim.copy(_forward);
      _aim.normalize();
      const reload = Math.max(0, Math.min(1, spec.reload || 0));
      const recoil = Math.max(0, Math.min(1, spec.recoil || 0));
      const len = this.lengths;
      solveArm(bones.rightArm, bones.rightForeArm, bones.rightHand, len.rightUpper, len.rightFore, true, _aim, _right, _forward, spec.aiming, reload, recoil);
      if (spec.aiming && bones.leftArm && bones.leftForeArm && bones.leftHand) {
        solveArm(bones.leftArm, bones.leftForeArm, bones.leftHand, len.leftUpper, len.leftFore, false, _aim, _right, _forward, true, reload, 0);
      }
      this.model.updateWorldMatrix(true, true);
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
