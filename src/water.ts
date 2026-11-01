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
  normals.repeat.set(size / 120, size / 120);

  const water = new Water(geo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: normals,
    sunDirection: sunPosition.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x15425c, // Lake Ontario blue-green
    distortionScale: 2.6,
    fog: scene.fog !== null,
  });
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
