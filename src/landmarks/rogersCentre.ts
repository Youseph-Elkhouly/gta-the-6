import * as THREE from "three";
import type { LandmarkBuildResult, LandmarkContext } from "./types";
import { concrete, concreteLight, concreteDark, ellipsePoints, colliderFromPoints } from "./util";

// Original Rogers Centre: an elliptical seating bowl with a segmented, low-profile
// retractable dome roof. Scaled from the real source footprint so it sits exactly
// where the stadium is, just south-west of the CN Tower.

// Open-ended elliptical "cylinder" (a tube) scaled from a unit cylinder.
function ellipticalWall(rx: number, rz: number, h: number, y: number, mat: THREE.Material, taperTop = 1): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(taperTop, 1, h, 56, 1, true);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(rx, 1, rz);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildRogersCentre(ctx: LandmarkContext): LandmarkBuildResult {
  const g = new THREE.Group();
  g.name = "landmark-rogers-centre";
  g.position.set(ctx.originX, 0, ctx.originZ);

  // Derive radii from the real footprint bbox (fall back to known dimensions).
  let halfX = 104;
  let halfZ = 99;
  if (ctx.source && ctx.source.rings[0]) {
    const r = ctx.source.rings[0];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < r.length; i += 2) {
      minX = Math.min(minX, r[i]); maxX = Math.max(maxX, r[i]);
      minZ = Math.min(minZ, r[i + 1]); maxZ = Math.max(maxZ, r[i + 1]);
    }
    halfX = ((maxX - minX) / 2) * 0.82;
    halfZ = ((maxZ - minZ) / 2) * 0.82;
  }

  const wallH = 32;

  // Lower concourse (slightly wider skirt).
  g.add(ellipticalWall(halfX * 1.05, halfZ * 1.05, 11, 5.5, concreteDark));
  // Main bowl exterior wall.
  g.add(ellipticalWall(halfX, halfZ, wallH, wallH / 2, concrete));
  // Top rim.
  g.add(ellipticalWall(halfX * 1.02, halfZ * 1.02, 3, wallH, concreteLight));

  // Inner seating bowl (narrows toward the field).
  const innerBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 0.52, wallH - 3, 56, 1, true),
    concreteDark,
  );
  innerBowl.scale.set(halfX, 1, halfZ);
  innerBowl.position.y = (wallH - 3) / 2 + 1.5;
  innerBowl.receiveShadow = true;
  g.add(innerBowl);

  // Playing field.
  const field = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: 0x55705a, roughness: 0.95 }),
  );
  field.scale.set(halfX * 0.55, halfZ * 0.55, 1);
  field.rotation.x = -Math.PI / 2;
  field.position.y = 1.4;
  field.receiveShadow = true;
  g.add(field);

  // Segmented retractable dome roof: four shallow panels with thin gaps.
  const rise = 48; // peak ~ wallH + rise ≈ 80 m
  const roofMat = concreteLight;
  const panels = 4;
  const gap = 0.045; // radians of gap between panels
  for (let i = 0; i < panels; i++) {
    const phiStart = i * (Math.PI * 2 / panels) + gap / 2;
    const phiLength = (Math.PI * 2 / panels) - gap;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 10, phiStart, phiLength, 0, Math.PI / 2),
      roofMat,
    );
    dome.scale.set(halfX * 1.0, rise, halfZ * 1.0);
    dome.position.y = wallH;
    dome.castShadow = true;
    dome.receiveShadow = true;
    g.add(dome);
  }

  // Collider + outline: the outer wall ellipse (players walk around, not through).
  const outline = ellipsePoints(ctx.originX, ctx.originZ, halfX * 1.02, halfZ * 1.02, 40);
  const colliders = [colliderFromPoints("rogers-centre", outline)];

  const bounds = new THREE.Box3(
    new THREE.Vector3(ctx.originX - halfX * 1.05, 0, ctx.originZ - halfZ * 1.05),
    new THREE.Vector3(ctx.originX + halfX * 1.05, wallH + rise, ctx.originZ + halfZ * 1.05),
  );

  return { object: g, colliders, bounds, footprintOutline: outline };
}
