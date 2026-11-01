import * as THREE from "three";
import type { Input } from "./input";

// Free-fly debug camera for inspecting the city from above / any angle.
// WASD = planar move, Space/KeyE = up, KeyC-held or ShiftLeft... handled in main.
const BASE_SPEED = 30; // m/s
const SPRINT_MULT = 4;
const LOOK_SENSITIVITY = 0.0022;

export class FlyCamera {
  position = new THREE.Vector3();
  yaw = 0;
  pitch = -0.5;

  applyLook(input: Input): void {
    this.yaw -= input.mouseDX * LOOK_SENSITIVITY;
    this.pitch -= input.mouseDY * LOOK_SENSITIVITY;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  syncFrom(camera: THREE.PerspectiveCamera): void {
    this.position.copy(camera.position);
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    this.yaw = e.y;
    this.pitch = e.x;
  }

  forward(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    );
  }

  update(dt: number, input: Input, camera: THREE.PerspectiveCamera): void {
    const fwd = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0;
    let my = 0;
    let mz = 0;
    if (input.down("KeyW")) {
      mx += fwd.x; my += fwd.y; mz += fwd.z;
    }
    if (input.down("KeyS")) {
      mx -= fwd.x; my -= fwd.y; mz -= fwd.z;
    }
    if (input.down("KeyD")) {
      mx += right.x; mz += right.z;
    }
    if (input.down("KeyA")) {
      mx -= right.x; mz -= right.z;
    }
    if (input.down("Space")) my += 1;
    if (input.down("KeyQ")) my -= 1;

    const len = Math.hypot(mx, my, mz);
    if (len > 1e-4) {
      const speed = (input.down("ShiftLeft") || input.down("ShiftRight") ? BASE_SPEED * SPRINT_MULT : BASE_SPEED) * dt;
      this.position.x += (mx / len) * speed;
      this.position.y += (my / len) * speed;
      this.position.z += (mz / len) * speed;
    }

    camera.position.copy(this.position);
    camera.lookAt(this.position.clone().add(fwd));
  }
}
