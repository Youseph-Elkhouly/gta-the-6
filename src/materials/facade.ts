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
          float gv = 0.82 + 0.30 * hash11(floorId * 1.7 + seed * 53.0);

          // two independent per-building random picks for palette variety
          float s2 = hash11(seed * 91.7 + 3.1);

          // --- glass curtain-wall tints (towers): blue / teal / bronze / charcoal ---
          vec3 glassTint =
              seed < 0.42 ? vec3(0.16, 0.34, 0.52) :   // blue
              seed < 0.70 ? vec3(0.13, 0.40, 0.36) :   // teal / green
              seed < 0.88 ? vec3(0.42, 0.31, 0.15) :   // bronze / gold
                            vec3(0.11, 0.13, 0.16);    // charcoal / black glass

          // --- concrete / office spandrel: warm beige, cool grey, light stone ---
          vec3 concreteCol =
              s2 < 0.40 ? vec3(0.66, 0.58, 0.45) :     // warm beige
              s2 < 0.74 ? vec3(0.54, 0.56, 0.58) :     // cool grey
                          vec3(0.76, 0.73, 0.64);      // light stone

          // --- brick / masonry (low-rise): red brick, brown, buff ---
          vec3 brickCol =
              s2 < 0.45 ? vec3(0.58, 0.29, 0.22) :     // red brick
              s2 < 0.80 ? vec3(0.47, 0.35, 0.26) :     // brown
                          vec3(0.72, 0.58, 0.38);      // buff / sandstone

          // Architectural category from height: tall=glass, low=masonry, else office.
          vec3 facadeCol = mix(concreteCol, glassTint, tall);
          facadeCol      = mix(facadeCol, brickCol, low);

          // glass panes: tinted, a bit darker than the spandrel, and reflective
          vec3 paneCol = (glassTint * 0.9 + 0.06) * gv;
          // masonry "windows" are dark recessed glass, not mirror glass
          paneCol = mix(paneCol, vec3(0.10, 0.12, 0.15) * gv, low);

          vec3 roofCol = mix(vec3(0.33, 0.31, 0.28), vec3(0.17, 0.18, 0.19), step(0.5, s2))
                         * (0.85 + 0.3 * seed);

          vec3 col = mix(mix(facadeCol, paneCol, pane), roofCol, roofMask);
          diffuseColor.rgb *= col;

          // glass panes: smooth + reflective; frames/spandrel/roof: matte.
          // Masonry windows are less mirror-like than curtain-wall glass.
          float paneMetal = pane * mix(mix(0.25, 0.85, tall), 0.1, low);
          float paneRough = mix(mix(0.80, 0.10, pane * (1.0 - low)), 0.92, roofMask);
          gFacadeRough = paneRough;
          gFacadeMetal = mix(paneMetal, 0.0, roofMask);
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
