import * as THREE from "three";
import { loadWorldData } from "./assets";
import { buildEnvironment } from "./environment";
import { buildBuildings } from "./buildings";
import { buildRoads } from "./roads";
import { Input } from "./input";
import { Player } from "./player";
import { FlyCamera } from "./flyCamera";
import { Hud } from "./hud";
import { Inspector } from "./inspector";
import { buildWater } from "./water";
import { Graphics } from "./postprocessing";
import { buildLandmarks } from "./landmarks/index";
import { LandmarkDebug } from "./landmarks/debug";
import { StreetViewPanel } from "./streetView";

type CameraMode = "player" | "fly";

// Render is capped to this rate to keep GPU cost down for the heavier graphics
// pipeline. Movement/physics still use real elapsed time, so motion is unchanged.
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;

async function main() {
  const app = document.getElementById("app")!;
  const loadingEl = document.getElementById("loading")!;
  const loadingBar = document.getElementById("loading-bar")!;
  const loadingStatus = document.getElementById("loading-status")!;
  const playPrompt = document.getElementById("play-prompt")!;

  const setProgress = (msg: string, frac: number) => {
    loadingStatus.textContent = msg;
    loadingBar.style.width = `${Math.round(frac * 100)}%`;
  };

  // --- renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (Khronos PBR Neutral) tone mapping preserves saturation far better
  // than ACES, which was washing the city to grey. Exposure kept moderate because
  // the physical Sky is very bright HDR.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.62;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 4500);

  // --- data + world ---
  let data;
  try {
    data = await loadWorldData(setProgress);
  } catch (err) {
    loadingStatus.textContent = `Failed to load map data: ${(err as Error).message}. ` +
      `Run the data pipeline (see README) then reload.`;
    console.error(err);
    return;
  }
  const { manifest } = data;

  const env = buildEnvironment(renderer, scene, manifest);

  // Landmark overrides: build first so we can suppress the generic buildings they
  // replace, then feed their footprint colliders into the shared collision grid.
  const landmarks = buildLandmarks(manifest, data.buildings);
  scene.add(landmarks.group);

  const buildingWorld = buildBuildings(data.buildings, env.envMap, landmarks.suppress);
  scene.add(buildingWorld.group);
  for (const c of landmarks.colliders) buildingWorld.grid.add(c);

  const landmarkDebug = new LandmarkDebug(landmarks, scene);

  const roadWorld = buildRoads(data.roads);
  scene.add(roadWorld.group);

  const lake = buildWater(scene, env.sunPosition, env.groundSouthEdge);

  // --- post-processing pipeline (AO, bloom, SMAA; quality-adjustable) ---
  const graphics = new Graphics(renderer, scene, camera);

  // --- player + cameras ---
  const player = new Player(manifest.spawn.x, manifest.spawn.z);
  player.yaw = manifest.spawn.yaw ?? 0;
  scene.add(player.object);

  const fly = new FlyCamera();
  fly.position.set(manifest.spawn.x, 260, manifest.spawn.z + 260);
  fly.yaw = 0;
  fly.pitch = -0.6;

  let mode: CameraMode = "player";
  const streetView = new StreetViewPanel(camera, manifest.area.centerLat, manifest.area.centerLon,
    () => mode === "fly" ? fly.position : player.position);

  const crosshair = document.getElementById("crosshair")!;
  const input = new Input(renderer.domElement);
  input.onLockChange = (locked) => {
    playPrompt.classList.toggle("visible", !locked);
    crosshair.classList.toggle("visible", locked);
  };

  const hud = new Hud();
  hud.setBuildingCount(buildingWorld.count);
  hud.setGraphics(graphics.quality);

  // eslint-disable-next-line no-new
  new Inspector(renderer, camera, buildingWorld, scene);

  const chunkSize = manifest.chunkSizeM;

  // --- resize ---
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    graphics.setSize(window.innerWidth, window.innerHeight);
  });

  function toggleMode() {
    if (mode === "player") {
      // enter fly: start from the current camera pose
      fly.syncFrom(camera);
      mode = "fly";
    } else {
      mode = "player";
    }
  }

  // position the camera once before first render (player mode)
  player.updateCamera(camera, buildingWorld.group);

  // --- hide loading, show play prompt ---
  setProgress("Ready — click to explore.", 1);
  loadingEl.classList.add("hidden");
  setTimeout(() => (loadingEl.style.display = "none"), 650);
  playPrompt.classList.add("visible");

  // --- main loop (render capped to TARGET_FPS) ---
  const clock = new THREE.Clock();
  let acc = 0;
  function frame() {
    requestAnimationFrame(frame);
    const elapsed = clock.getDelta();
    acc += elapsed * 1000;
    if (acc < FRAME_MS) return; // skip this animation frame to hold ~TARGET_FPS
    const dt = Math.min(acc / 1000, 0.1); // real time since last rendered frame (clamped)
    acc = 0;

    // mode toggles (edge-triggered)
    if (input.pressed("KeyC") || input.pressed("KeyF")) toggleMode();
    if (input.pressed("KeyG")) hud.setGraphics(graphics.cycleQuality());
    if (input.pressed("KeyL")) landmarkDebug.toggle();
    // Teleport the fly camera to frame the CN Tower + Rogers Centre together.
    if (input.pressed("KeyT") && landmarks.teleport) {
      mode = "fly";
      fly.position.set(...landmarks.teleport.pos);
      fly.yaw = landmarks.teleport.yaw;
      fly.pitch = landmarks.teleport.pitch;
    }

    if (mode === "player") {
      if (input.locked) player.applyLook(input);
      player.update(dt, input, buildingWorld.grid);
      player.updateCamera(camera, buildingWorld.group);
      player.object.visible = true;
      const p = player.position;
      hud.setPosition(p.x, p.y, p.z);
      hud.setChunk(Math.floor(p.x / chunkSize), Math.floor(p.z / chunkSize));
      hud.setCameraMode("3rd-person");
    } else {
      if (input.locked) fly.applyLook(input);
      fly.update(dt, input, camera);
      player.object.visible = true; // keep character visible to locate in fly-cam
      hud.setPosition(fly.position.x, fly.position.y, fly.position.z);
      hud.setChunk(Math.floor(fly.position.x / chunkSize), Math.floor(fly.position.z / chunkSize));
      hud.setCameraMode("free-fly");
    }

    hud.tickFps(dt);
    streetView.updatePosition();
    landmarkDebug.update(camera, window.innerWidth, window.innerHeight);
    lake.update(dt);
    graphics.render();
    input.endFrame();
  }
  frame();

  // expose a few handles for debugging in the console / automated verification
  (window as any).__gta6 = {
    THREE,
    scene,
    camera,
    renderer,
    player,
    fly,
    buildingWorld,
    roadWorld,
    lake,
    graphics,
    landmarks,
    landmarkDebug,
    manifest,
    get mode() {
      return mode;
    },
    // Jump into free-fly at a given pose (used by aerial verification + debugging).
    setFly(pos: [number, number, number], yaw: number, pitch: number) {
      mode = "fly";
      fly.position.set(pos[0], pos[1], pos[2]);
      fly.yaw = yaw;
      fly.pitch = pitch;
    },
  };
}

main();
