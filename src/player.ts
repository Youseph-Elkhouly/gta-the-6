import * as THREE from "three";
import type { Input } from "./input";
import type { CollisionGrid } from "./collision";

const GRAVITY = 24; // m/s^2 (snappy, game-y)
const WALK_SPEED = 5.2; // m/s
const SPRINT_SPEED = 10.5; // m/s
const JUMP_SPEED = 8.2; // m/s
const PLAYER_RADIUS = 0.45;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.55;

const CAM_DISTANCE = 6.5;
const CAM_MIN_DISTANCE = 1.2;
const CAM_HEIGHT = 1.5;
const LOOK_SENSITIVITY = 0.0022;
// pitch = vertical angle of the camera offset behind the player.
// Larger pitch => camera higher & looking down; smaller => camera low, looking up.
const PITCH_MIN = -0.55;
const PITCH_MAX = 1.1;

export class Player {
  readonly object = new THREE.Group(); // placeholder character root
  position = new THREE.Vector3(); // feet position (y = ground contact)
  private velocityY = 0;
  private onGround = true;

  // Orbit camera state (also drives movement heading).
  yaw = 0;
  pitch = 0.28;

  private tmp = { x: 0, z: 0 };
  private raycaster = new THREE.Raycaster();

  constructor(spawnX: number, spawnZ: number) {
    this.position.set(spawnX, 0, spawnZ);

    // Low-poly placeholder: a capsule body + a small "facing" nub.
    const bodyGeo = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2, 6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a8cff, roughness: 0.5, metalness: 0.05 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = PLAYER_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this.object.add(body);

    // facing indicator (so you can see which way the character points)
    const noseGeo = new THREE.BoxGeometry(0.22, 0.22, 0.34);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, PLAYER_HEIGHT * 0.62, PLAYER_RADIUS + 0.1);
    nose.castShadow = true;
    this.object.add(nose);

    this.object.position.copy(this.position);
  }

  get isOnGround(): boolean {
    return this.onGround;
  }

  // Apply accumulated mouse look (used while this controller is active).
  applyLook(input: Input): void {
    this.yaw -= input.mouseDX * LOOK_SENSITIVITY;
    // mouse up (negative dy) lowers the camera so you look up at the towers
    this.pitch += input.mouseDY * LOOK_SENSITIVITY;
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
  }

  update(dt: number, input: Input, grid: CollisionGrid): void {
    // --- horizontal movement relative to camera yaw ---
    // forward (into screen) on XZ for yaw: (sin(yaw) ... ) We define yaw=0 looking -Z.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward vector (yaw=0 => -Z)
    const fwdX = -sin;
    const fwdZ = -cos;
    // right vector
    const rightX = cos;
    const rightZ = -sin;

    let moveX = 0;
    let moveZ = 0;
    if (input.down("KeyW")) {
      moveX += fwdX;
      moveZ += fwdZ;
    }
    if (input.down("KeyS")) {
      moveX -= fwdX;
      moveZ -= fwdZ;
    }
    if (input.down("KeyD")) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (input.down("KeyA")) {
      moveX -= rightX;
      moveZ -= rightZ;
    }

    const mlen = Math.hypot(moveX, moveZ);
    const speed = input.down("ShiftLeft") || input.down("ShiftRight") ? SPRINT_SPEED : WALK_SPEED;
    if (mlen > 1e-4) {
      moveX = (moveX / mlen) * speed * dt;
      moveZ = (moveZ / mlen) * speed * dt;

      let nx = this.position.x + moveX;
      let nz = this.position.z + moveZ;
      // Resolve against building footprints.
      grid.resolve(nx, nz, PLAYER_RADIUS, this.tmp);
      this.position.x = this.tmp.x;
      this.position.z = this.tmp.z;

      // face the movement direction
      this.object.rotation.y = Math.atan2(moveX, moveZ);
    }

    // --- jump + gravity ---
    if ((input.down("Space")) && this.onGround) {
      this.velocityY = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocityY -= GRAVITY * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.onGround = true;
    }

    this.object.position.copy(this.position);
  }

  // Position the third-person camera behind the player, pulling in if a
  // building would clip the view.
  updateCamera(camera: THREE.PerspectiveCamera, obstacles?: THREE.Object3D): void {
    const target = new THREE.Vector3(
      this.position.x,
      this.position.y + CAM_HEIGHT,
      this.position.z,
    );

    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cp,
    );

    let dist = CAM_DISTANCE;
    if (obstacles) {
      this.raycaster.set(target, dir.clone().normalize());
      this.raycaster.far = CAM_DISTANCE;
      const hits = this.raycaster.intersectObject(obstacles, true);
      if (hits.length > 0) {
        dist = Math.max(CAM_MIN_DISTANCE, hits[0].distance - 0.3);
      }
    }

    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
  }

  getEyeWorld(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }
}
