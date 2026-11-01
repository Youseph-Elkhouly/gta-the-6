import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { makeWaterNormals } from "./textures";

// Lake Ontario — a large reflective water plane filling the area south (local +z)
// of the city's land edge and extending out to the horizon.

export interface WaterRig {
  water: Water;
  update: (dt: number) => void;
}

export function buildWater(
  scene: THREE.Scene,
  sunPosition: THREE.Vector3,
  southEdge: number,
): WaterRig {
  const size = 12000;
  const geo = new THREE.PlaneGeometry(size, size);

  const normals = makeWaterNormals();
  // Water.js samples normals in world coordinates, so texture.repeat does not
  // affect its shader. Control the actual wave scale through the `size` uniform.

  const water = new Water(geo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: normals,
    sunDirection: sunPosition.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x246985, // cool blue-green Lake Ontario, visible through reflections
    distortionScale: 0.8,
    fog: scene.fog !== null,
  });
  // The stock Water shader makes very broad, mirror-bright swells at this map
  // scale. Bring the wavelets down to ~10–20 m and keep more of the lake's blue
  // body color visible away from the horizon.
  water.material.uniforms["size"].value = 7.0;
  water.material.uniforms["distortionScale"].value = 0.8;
  water.material.fragmentShader = water.material.fragmentShader
    .replace("float rf0 = 0.3;", "float rf0 = 0.055;")
    .replace(
      "vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );",
      "vec3 surfaceNormal = normalize( noise.xzy * vec3( 0.55, 1.0, 0.55 ) );",
    );
  water.material.needsUpdate = true;
  water.rotation.x = -Math.PI / 2;
  // Centre the plane well south of the land edge so its near shore sits at southEdge.
  water.position.set(0, -0.15, southEdge + size / 2 - 40);
  water.name = "lake-ontario";
  scene.add(water);

  const uniforms = water.material.uniforms;
  return {
    water,
    update: (dt: number) => {
      uniforms["time"].value += dt;
    },
  };
}
