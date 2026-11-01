import * as THREE from "three";

// A single MeshStandardMaterial whose surface is painted procedurally in the
// shader: a per-floor window grid, glass vs concrete vs brick chosen by building
// height, and per-building colour variation from a random seed. Because it stays
// one material, buildings keep merging into one mesh per chunk (low draw calls)
// and the raycast triangle->building mapping is unaffected.
//
// Per-building variety is fed in via two vertex attributes added in buildings.ts:
//   aSeed   — one random value in [0,1) per building
//   aHeight — building height in metres
// World position + object-space normal classify roof vs wall and the facade axis.

export function createFacadeMaterial(envMap: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 1.15,
  });

  mat.onBeforeCompile = (shader) => {
    // ---- vertex: pass world pos, object normal, seed, height ----
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aSeed;
        attribute float aHeight;
        varying vec3 vWorldPos;
        varying vec3 vObjNormal;
        varying float vSeed;
        varying float vBH;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSeed = aSeed;
        vBH = aHeight;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vObjNormal = objectNormal;`,
      );

    // ---- fragment: window grid + material class ----
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vObjNormal;
        varying float vSeed;
        varying float vBH;
        float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
        // computed in color_fragment, consumed in roughness/metalness chunks:
        float gFacadeRough;
        float gFacadeMetal;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 nrm = normalize(vObjNormal);
          float roofMask = step(0.6, abs(nrm.y));
          float horiz = abs(nrm.x) > abs(nrm.z) ? vWorldPos.z : vWorldPos.x;
          float vert = vWorldPos.y;
          float seed = vSeed;
          float bh = vBH;

          float tall = step(80.0, bh);          // glass curtain wall
          float low  = 1.0 - step(20.0, bh);    // brick / concrete low-rise

          float floorH = mix(3.4, 3.15, tall);
          float winW   = mix(2.2, 3.1, tall);
          float mull    = mix(0.16, 0.06, tall); // frame thickness fraction

          float fu = fract(horiz / winW);
          float fv = fract((vert - 0.5) / floorH);
          float paneX = step(mull, fu) * step(fu, 1.0 - mull);
          float paneY = step(mull * 0.9, fv) * step(fv, 1.0 - mull * 1.5);
          float pane = paneX * paneY * (1.0 - roofMask);

          // per-floor, per-building glass tint variation
          float floorId = floor(vert / floorH);
          float gv = 0.8 + 0.35 * hash11(floorId * 1.7 + seed * 53.0);

          vec3 glassTint   = vec3(0.30, 0.44, 0.58);
          vec3 concreteCol = vec3(0.56, 0.56, 0.54) * (0.82 + 0.3 * seed);
          vec3 brickCol    = vec3(0.56, 0.40, 0.35) * (0.85 + 0.3 * seed);
          vec3 facadeCol   = mix(concreteCol, glassTint * 0.95, tall);
          facadeCol        = mix(facadeCol, brickCol, low * 0.7);

          vec3 paneCol = mix(vec3(0.18, 0.26, 0.36), glassTint, 0.55) * gv;
          vec3 roofCol = vec3(0.21, 0.22, 0.235) * (0.85 + 0.3 * seed);

          vec3 col = mix(mix(facadeCol, paneCol, pane), roofCol, roofMask);
          diffuseColor.rgb *= col;

          // glass panes: smooth + reflective; frames/spandrel/roof: matte
          gFacadeRough = mix(mix(0.82, 0.08, pane), 0.95, roofMask);
          gFacadeMetal = mix(mix(0.0, mix(0.35, 0.9, tall), pane), 0.0, roofMask);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = gFacadeRough;`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `float metalnessFactor = gFacadeMetal;`,
      );
  };

  // Ensure the custom shader isn't shared/cached with the default standard mat.
  mat.customProgramCacheKey = () => "facade-v1";
  return mat;
}
