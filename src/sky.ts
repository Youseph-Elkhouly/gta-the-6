import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

// Physical atmospheric sky (Preetham model) tuned for a clear Toronto midday,
// plus an image-based-lighting environment map generated from that sky so glass
// and metal reflect a real sky and ambient fill is sky-coloured.

export interface SkyRig {
  sky: Sky;
  envMap: THREE.Texture;
  sunPosition: THREE.Vector3; // normalized-ish direction to the sun
}

export function buildSky(renderer: THREE.WebGLRenderer, scene: THREE.Scene): SkyRig {
  const sky = new Sky();
  sky.scale.setScalar(450000); // huge; the shader pins it to the far plane (z=w)
  sky.name = "sky";

  const u = sky.material.uniforms;
  u.turbidity.value = 1.4;        // low haze = clean blue
  u.rayleigh.value = 2.6;         // strong blue scattering
  u.mieCoefficient.value = 0.003; // small sun glow
  u.mieDirectionalG.value = 0.75;

  // Sun placement: high, clear-midday elevation, from the south-west so the
  // cast shadows read well across the downtown grid.
  const elevation = 62; // degrees above horizon
  const azimuth = 135;  // degrees clockwise from north
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunPosition);

  scene.add(sky);

  // Generate the IBL environment from the sky (once).
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const skyForEnv = new Sky();
  skyForEnv.scale.setScalar(450000);
  skyForEnv.material.uniforms.turbidity.value = u.turbidity.value;
  skyForEnv.material.uniforms.rayleigh.value = u.rayleigh.value;
  skyForEnv.material.uniforms.mieCoefficient.value = u.mieCoefficient.value;
  skyForEnv.material.uniforms.mieDirectionalG.value = u.mieDirectionalG.value;
  skyForEnv.material.uniforms.up.value.copy(u.up.value);
  skyForEnv.material.uniforms.sunPosition.value.copy(sunPosition);
  envScene.add(skyForEnv);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
  const envMap = rt.texture;
  pmrem.dispose();
  skyForEnv.geometry.dispose();
  (skyForEnv.material as THREE.Material).dispose();

  return { sky, envMap, sunPosition };
}
