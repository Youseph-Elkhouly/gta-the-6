import * as THREE from "three";
import type { Manifest } from "./types";
import { buildSky } from "./sky";
import { makeConcreteTexture } from "./textures";

export interface EnvRig {
  sun: THREE.DirectionalLight;
  ground: THREE.Mesh;
  envMap: THREE.Texture;
  sunPosition: THREE.Vector3;
  groundSouthEdge: number; // local +z where land ends and the lake begins
}

// Builds sky (physical + IBL), lighting, shadows, and textured ground.
export function buildEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  manifest: Manifest,
): EnvRig {
  // --- Physical sky + image-based lighting ---
  const { envMap, sunPosition } = buildSky(renderer, scene);
  scene.environment = envMap; // sky-coloured ambient + reflections on glass/metal

  // --- Light atmospheric haze; only softens the far map edges ---
  const fogColor = new THREE.Color(0xc2d4e8);
  scene.fog = new THREE.Fog(fogColor, 900, 3600);

  // --- Lighting: the sun (shadow caster) aligned to the sky; IBL does the fill ---
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
  sun.position.copy(sunPosition).multiplyScalar(600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 440;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  // A touch of hemisphere light on top of IBL to lift deep shadows; warm ground
  // bounce keeps the shadowed sides from going cold/blue-grey.
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x6b6052, 0.4);
  scene.add(hemi);

  // --- Flat textured ground (land). Trimmed on the south side so the lake shows. ---
  const [minX, minZ, maxX, maxZ] = manifest.area.boundsLocal;
  const landMargin = 160;
  const groundSouthEdge = maxZ + landMargin * 0.4; // land ends a bit past the south bound
  const west = minX - landMargin;
  const east = maxX + landMargin;
  const north = minZ - landMargin;
  const width = east - west;
  const depth = groundSouthEdge - north;

  const concrete = makeConcreteTexture();
  concrete.repeat.set(width / 12, depth / 12); // ~12 m per tile

  const groundGeo = new THREE.PlaneGeometry(width, depth);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xcfc9bb, // warm light concrete/pavement (texture provides detail)
    map: concrete,
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.8,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set((west + east) / 2, 0, (north + groundSouthEdge) / 2);
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  return { sun, ground, envMap, sunPosition, groundSouthEdge };
}
