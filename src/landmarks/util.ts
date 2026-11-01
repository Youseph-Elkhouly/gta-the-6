import * as THREE from "three";
import type { PolyCollider } from "../collision";

// Shared helpers for hand-built landmark models: neutral materials, footprint
// shape generators, and collider construction.

export const concrete = new THREE.MeshStandardMaterial({
  color: 0x9b9ca0,
  roughness: 0.85,
  metalness: 0.02,
});
export const concreteLight = new THREE.MeshStandardMaterial({
  color: 0xb4b6ba,
  roughness: 0.8,
  metalness: 0.02,
});
export const concreteDark = new THREE.MeshStandardMaterial({
  color: 0x6f7175,
  roughness: 0.9,
  metalness: 0.02,
});
export const glassNeutral = new THREE.MeshStandardMaterial({
  color: 0x5c6b78,
  roughness: 0.18,
  metalness: 0.65,
  envMapIntensity: 1.0,
});
export const steel = new THREE.MeshStandardMaterial({
  color: 0x8a8d92,
  roughness: 0.45,
  metalness: 0.7,
});

// Local-space ellipse outline as a flat [x,z,...] array.
export function ellipsePoints(ox: number, oz: number, rx: number, rz: number, segments = 32): number[] {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(ox + Math.cos(a) * rx, oz + Math.sin(a) * rz);
  }
  return pts;
}

export function regularPolyPoints(ox: number, oz: number, r: number, sides: number, rot = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(ox + Math.cos(a) * r, oz + Math.sin(a) * r);
  }
  return pts;
}

export function rectPoints(ox: number, oz: number, halfX: number, halfZ: number): number[] {
  return [ox - halfX, oz - halfZ, ox + halfX, oz - halfZ, ox + halfX, oz + halfZ, ox - halfX, oz + halfZ];
}

// Build a PolyCollider from a flat [x,z,...] ring.
export function colliderFromPoints(id: string, pts: number[]): PolyCollider {
  const n = pts.length / 2;
  const arr = new Float32Array(pts);
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = arr[i * 2];
    const z = arr[i * 2 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { id, pts: arr, minX, minZ, maxX, maxZ };
}
