import * as THREE from "three";
import type { LandmarkBuildResult, LandmarkContext } from "./types";
import { concrete, concreteLight, concreteDark, glassNeutral, steel, regularPolyPoints, colliderFromPoints } from "./util";

// Original low-poly CN Tower: tapered hexagonal concrete shaft on three legs, the
// main observation pod ("the donut"), the higher SkyPod, and the antenna mast —
// built from Three.js primitives, ~553 m tall. Base sits on the ground (y=0) at
// the source footprint origin.

function cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCNTower(ctx: LandmarkContext): LandmarkBuildResult {
  const g = new THREE.Group();
  g.name = "landmark-cn-tower";
  g.position.set(ctx.originX, 0, ctx.originZ);

  // --- three tapered base legs (the Y-shaped foot) ---
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(10, 112, 26), concreteDark);
    leg.position.set(Math.cos(ang) * 9, 56, Math.sin(ang) * 9);
    leg.rotation.y = -ang;
    leg.rotation.z = 0; // slabs radiate outward from the shaft
    leg.castShadow = true;
    leg.receiveShadow = true;
    g.add(leg);
  }

  // --- tapered hexagonal main shaft (ground to the main pod) ---
  const shaft = cyl(7, 16, 330, 6, concrete, 165);
  shaft.rotation.y = Math.PI / 6;
  g.add(shaft);

  // --- main observation pod at ~335-362 m ---
  g.add(cyl(24, 9, 18, 24, concrete, 330)); // flared underside
  g.add(cyl(24, 24, 16, 24, glassNeutral, 347)); // main deck (glazed)
  g.add(cyl(9, 24, 10, 24, concreteLight, 360)); // upper taper

  // --- upper shaft to the SkyPod ---
  const upper = cyl(6, 7, 92, 6, concrete, 411);
  upper.rotation.y = Math.PI / 6;
  g.add(upper);

  // --- SkyPod at ~447 m ---
  g.add(cyl(10, 9, 14, 16, glassNeutral, 447));
  g.add(cyl(8, 10, 6, 16, concreteLight, 457));

  // --- antenna mast to ~553 m ---
  g.add(cyl(0.4, 2.4, 98, 12, steel, 503));

  // Footprint collider: a hexagon around the shaft/legs core.
  const foot = regularPolyPoints(ctx.originX, ctx.originZ, 20, 6, Math.PI / 6);
  const colliders = [colliderFromPoints("cn-tower", foot)];

  // Debug outline (same hexagon), world-space bounds.
  const bounds = new THREE.Box3(
    new THREE.Vector3(ctx.originX - 26, 0, ctx.originZ - 26),
    new THREE.Vector3(ctx.originX + 26, 553, ctx.originZ + 26),
  );

  return { object: g, colliders, bounds, footprintOutline: foot };
}
