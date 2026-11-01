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
  const brickTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/brick-color.jpg`);
  brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
  brickTexture.colorSpace = THREE.SRGBColorSpace;
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
        attribute float aCategory;
        varying vec3 vWorldPos;
        varying vec3 vObjNormal;
        varying float vSeed;
        varying float vBH;
        varying float vCat;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSeed = aSeed;
        vBH = aHeight;
        vCat = aCategory;`,
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
        varying float vCat;
        uniform sampler2D uBrickColor;
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
          float s2 = hash11(seed * 91.7 + 3.1);

          // Architectural category (0..6). If unmatched (<0), derive one from height.
          float cat = vCat;
          if (cat < -0.5) {
            cat = bh >= 80.0 ? 0.0 : (bh < 20.0 ? 3.0 : 2.0);
          }
          // eqc(v) = 1 when cat == v
          #define EQC(v) (1.0 - step(0.5, abs(cat - (v))))
          float cGlass = EQC(0.0);  // glass tower
          float cResid = EQC(1.0);  // residential tower
          float cOffMd = EQC(2.0);  // office mid-rise
          float cMason = EQC(3.0);  // masonry low-rise
          float cInst  = EQC(4.0);  // institutional / stone
          float cHouse = EQC(5.0);  // house
          float cUtil  = EQC(6.0);  // utility / parking

          // --- window grid metrics per category ---
          float floorH = 3.3*cGlass + 3.0*cResid + 3.4*cOffMd + 3.6*cMason + 4.6*cInst + 3.0*cHouse + 3.6*cUtil;
          float winW   = 3.2*cGlass + 2.0*cResid + 2.5*cOffMd + 2.0*cMason + 1.7*cInst + 1.7*cHouse + 3.4*cUtil;
          float mull   = 0.06*cGlass + 0.16*cResid + 0.11*cOffMd + 0.24*cMason + 0.30*cInst + 0.30*cHouse + 0.34*cUtil;
          floorH = max(floorH, 2.6);
          winW = max(winW, 1.4);

          float fu = fract(horiz / winW);
          float fv = fract((vert - 0.5) / floorH);
          float paneX = step(mull, fu) * step(fu, 1.0 - mull);
          float paneY = step(mull * 0.9, fv) * step(fv, 1.0 - mull * 1.5);
          float pane = paneX * paneY * (1.0 - roofMask);
          // utility/parking: horizontal open decks rather than punched windows
          pane = mix(pane, step(0.25, fv) * step(fv, 0.8) * (1.0 - roofMask), cUtil);

          float floorId = floor(vert / floorH);
          float gv = 0.82 + 0.30 * hash11(floorId * 1.7 + seed * 53.0);

          // --- palettes ---
          vec3 glassTint =
              seed < 0.42 ? vec3(0.16, 0.34, 0.52) :   // blue
              seed < 0.70 ? vec3(0.13, 0.40, 0.36) :   // teal
              seed < 0.88 ? vec3(0.42, 0.31, 0.15) :   // bronze
                            vec3(0.11, 0.13, 0.16);    // charcoal
          vec3 concreteCol =
              s2 < 0.40 ? vec3(0.66, 0.58, 0.45) :     // warm beige
              s2 < 0.74 ? vec3(0.54, 0.56, 0.58) :     // cool grey
                          vec3(0.76, 0.73, 0.64);      // light stone
          vec3 brickCol =
              s2 < 0.45 ? vec3(0.58, 0.29, 0.22) :     // red brick
              s2 < 0.80 ? vec3(0.47, 0.35, 0.26) :     // brown
                          vec3(0.72, 0.58, 0.38);      // buff
          vec3 brickTexel = texture2D(uBrickColor, vec2(horiz, vert) * 0.45).rgb;
          brickCol *= mix(vec3(1.0), brickTexel * 1.8, 0.78);
          vec3 stoneCol = vec3(0.78, 0.75, 0.66);
          vec3 utilCol  = vec3(0.56, 0.56, 0.54);

          // spandrel / wall colour per category
          vec3 facadeCol = glassTint*cGlass + concreteCol*(cResid+cOffMd)
                         + brickCol*(cMason+cHouse) + stoneCol*cInst + utilCol*cUtil;

          // window pane colour per category (curtain-wall glass vs punched dark glass)
          vec3 curtain = (glassTint * 0.9 + 0.06) * gv;
          vec3 punched = vec3(0.10, 0.12, 0.15) * gv;
          vec3 litGlass = vec3(0.16, 0.22, 0.30) * gv;
          vec3 paneCol = curtain*(cGlass+cOffMd) + litGlass*cResid
                       + punched*(cMason+cHouse+cInst+cUtil);

          vec3 roofCol = mix(vec3(0.33, 0.31, 0.28), vec3(0.17, 0.18, 0.19), step(0.5, s2))
                         * (0.85 + 0.3 * seed);

          vec3 col = mix(mix(facadeCol, paneCol, pane), roofCol, roofMask);
          diffuseColor.rgb *= col;

          // reflectivity: curtain-wall glass is mirror-like; everything else matte.
          float glassy = cGlass + 0.7*cOffMd + 0.4*cResid;
          float paneMetal = pane * glassy * 0.9;
          gFacadeRough = mix(mix(0.85, 0.08, pane * glassy), 0.92, roofMask);
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
    shader.uniforms.uBrickColor = { value: brickTexture };
  };

  // Ensure the custom shader isn't shared/cached with the default standard mat.
  mat.customProgramCacheKey = () => "facade-v3-cc0-brick";
  return mat;
}
