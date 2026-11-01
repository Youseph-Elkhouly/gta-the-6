import * as THREE from "three";
import type { LandmarkBuildResult, LandmarkContext } from "./types";
import { concrete, concreteLight, rectPoints, colliderFromPoints } from "./util";

// Original simplified Beaux-Arts Union Station: a long low stone block with a
// raised central great-hall roofline and a grand colonnade along the Front Street
// (south) facade. Built from primitives; neutral stone materials.

export function buildUnionStation(ctx: LandmarkContext): LandmarkBuildResult {
  const g = new THREE.Group();
  g.name = "landmark-union-station";
  g.position.set(ctx.originX, 0, ctx.originZ);

  const lenX = 228; // along Front Street (east-west)
  const depthZ = 40;
  const mainH = 26;

  // Main block.
  const block = new THREE.Mesh(new THREE.BoxGeometry(lenX, mainH, depthZ), concreteLight);
  block.position.y = mainH / 2;
  block.castShadow = true;
  block.receiveShadow = true;
  g.add(block);

  // Cornice.
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(lenX + 4, 3, depthZ + 4), concrete);
  cornice.position.y = mainH + 1;
  cornice.castShadow = true;
  g.add(cornice);

  // Raised central great-hall section.
  const centre = new THREE.Mesh(new THREE.BoxGeometry(76, 14, depthZ + 2), concreteLight);
  centre.position.set(0, mainH + 8, 0);
  centre.castShadow = true;
  centre.receiveShadow = true;
  g.add(centre);
  const centreRoof = new THREE.Mesh(new THREE.BoxGeometry(80, 3, depthZ + 6), concrete);
  centreRoof.position.set(0, mainH + 16, 0);
  centreRoof.castShadow = true;
  g.add(centreRoof);

  // Grand colonnade along the south (Front Street, +z) facade.
  const colH = 20;
  const zFront = depthZ / 2 + 3;
  const count = 14;
  const span = lenX - 24;
  for (let i = 0; i < count; i++) {
    const x = -span / 2 + (span * i) / (count - 1);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, colH, 14), concreteLight);
    col.position.set(x, colH / 2, zFront);
    col.castShadow = true;
    col.receiveShadow = true;
    g.add(col);
  }
  // Entablature carried by the columns.
  const entab = new THREE.Mesh(new THREE.BoxGeometry(span + 10, 5, 7), concrete);
  entab.position.set(0, colH + 2.5, zFront);
  entab.castShadow = true;
  g.add(entab);

  const half = rectPoints(ctx.originX, ctx.originZ, lenX / 2, depthZ / 2 + 3);
  const colliders = [colliderFromPoints("union-station", half)];
  const bounds = new THREE.Box3(
    new THREE.Vector3(ctx.originX - lenX / 2 - 2, 0, ctx.originZ - depthZ / 2 - 5),
    new THREE.Vector3(ctx.originX + lenX / 2 + 2, mainH + 18, ctx.originZ + depthZ / 2 + 5),
  );

  return { object: g, colliders, bounds, footprintOutline: half };
}
